/**
 * KAMPS AI analyst endpoint: POST /api/kamps/analyst
 *
 * Answers questions strictly from a structured digest of the current KAMPS
 * analysis (six-stage pipeline output). The z-ai-web-dev-sdk is imported
 * server-side only, via createRequire (verified working pattern in this repo).
 * Simple in-memory rate limit: 10 questions per minute per process.
 */
import { createRequire } from "module";
import { getKampsAnalysis } from "@/lib/kamps/engine";
import type { KampsAnalysis } from "@/lib/kamps/engine";

const require = createRequire(import.meta.url);
const ZAI = (require("z-ai-web-dev-sdk").default ?? require("z-ai-web-dev-sdk")) as {
  create: () => Promise<{
    chat: {
      completions: {
        create: (args: {
          messages: Array<{ role: "system" | "user"; content: string }>;
          thinking: { type: "disabled" };
        }) => Promise<{ choices: Array<{ message?: { content?: string } }> }>;
      };
    };
  }>;
};

export const dynamic = "force-dynamic";

// ————————————————————————————— in-memory rate limit —————————————————————————————

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const hits: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  while (hits.length > 0 && now - hits[0] > WINDOW_MS) hits.shift();
  if (hits.length >= RATE_LIMIT) return true;
  hits.push(now);
  return false;
}

// ———————————————————————————————— data digest ————————————————————————————————

function renderDigest(a: KampsAnalysis): string {
  const lines: string[] = [];
  const o = a.overview;
  lines.push(
    `KAMPS (Kenya Abduction Monitoring & Prediction System) analysis digest, as of ${a.asOf.slice(0, 10)}.`,
    `Data: REAL ingested datasets (Missing Voices victims and monthly statistics, curated public-record incidents with source URLs, KNBS 2019 census county populations, UCDP GED organized-violence events 1989-2025, ACLED Kenya weekly county aggregates 1997 through the week of 2026-09-12). Monitoring window ${a.dataWindow.start} to ${a.dataWindow.end}. ${a.zones} counties monitored.`,
    `Overview: ${o.documentedTotal} documented incidents in the window (${o.documentedLocated} county-located, ${o.unlocatedIncidents} without a resolvable county); adjusted estimate of the true total is ${o.estimatedTotal} (95% CI ${o.estimateCI[0]} to ${o.estimateCI[1]}), underreporting factor ${o.underreportingFactor}x.`
  );

  const m = a.mse;
  lines.push(
    `Capture-recapture status: method ${m.method}, lists ${m.listA} (${m.nA} records) vs ${m.listB} (${m.nB} records), matched overlap ${m.overlap}. ${m.note}`
  );
  lines.push(
    `List capture rates within the documented window: Missing Voices ${o.captureRates.mv}%, public-record news ${o.captureRates.ob}%.`
  );

  lines.push(`Zones by composite risk index (all ${a.zones} monitored counties):`);
  const topZones = [...a.zones].sort((x, y) => y.index - x.index);
  for (const z of topZones) {
    lines.push(
      `${z.name} (${z.county} county): index ${z.index}, band ${z.band}, confidence ${z.confidence}. Documented incidents ${z.documented} (crude rate ${z.crudeRate} per 100k). EB-smoothed rate ${z.ebRate} per 100k (CI ${z.ebCI[0]} to ${z.ebCI[1]}). MSE-adjusted estimate ${z.mseEstimated} (x${z.mseFactor} underreporting, ${z.mseConfidence} confidence). ACLED trailing-12-month corroboration: ${z.acledAbductions12m} abduction events and ${z.acledVacEvents12m} violence-against-civilians events. Cluster RR ${z.clusterRR ?? "none"}, temporal anomaly z ${z.temporalZ} (recent ${z.temporalCurrent} vs baseline ${z.temporalBaseline}), vehicle signal ${z.vehicleSignal ? "present" : "none"}. Drivers: ${z.drivers.join("; ")}.`
    );
  }
  const abd12 = a.zones.reduce((s, z) => s + z.acledAbductions12m, 0);
  const vac12 = a.zones.reduce((s, z) => s + z.acledVacEvents12m, 0);
  lines.push(
    `ACLED national corroboration: ${abd12} abduction/forced-disappearance events and ${vac12} violence-against-civilians events in the trailing 12 months (independent conflict-coded counts; they will not match the civil-society documented tally because ACLED applies conflict-coding scope rules).`
  );

  const sigClusters = a.clusters.filter((c) => c.p <= 0.05);
  if (sigClusters.length > 0) {
    lines.push("Statistically significant spatial clusters (p <= 0.05):");
    for (const c of sigClusters) {
      lines.push(
        `Cluster of ${c.zoneNames.join(", ")}: relative risk ${c.rr}, p ${c.p < 0.001 ? "< 0.001" : c.p}, observed ${c.observed} vs expected ${c.expected}, radius ${c.radiusKm} km.`
      );
    }
  } else {
    lines.push("No statistically significant spatial clusters at p <= 0.05.");
  }

  const flagged = a.vehicles.filter((v) => v.status === "flagged");
  const monitoring = a.vehicles.filter((v) => v.status === "monitoring");
  lines.push(
    `Vehicle pattern assessment (rule: at least ${a.vehicleRule.threshold} sightings within ${a.vehicleRule.windowDays} days inside ${a.vehicleRule.radiusKm} km, overlapping verified incidents within ${a.vehicleRule.incidentLeadDays} days): ${flagged.length} flagged, ${monitoring.length} under monitoring, ${a.vehicles.filter((v) => v.status === "cleared").length} cleared.`
  );
  for (const v of [...flagged, ...monitoring].slice(0, 8)) {
    lines.push(
      `${v.vehicleKey} (${v.color} ${v.make} ${v.model}, plate ${v.platePartial}, publicly documented with sources): ${v.status}, ${v.clusterSightings} clustered sightings in ${v.zones.length} zones, incident overlap ${v.incidentOverlap}, ${v.confidence} confidence, last seen ${v.lastSeen.slice(0, 10)}.`
    );
  }

  const bySev: Record<string, number> = {};
  for (const al of a.alerts) bySev[al.severity] = (bySev[al.severity] ?? 0) + 1;
  lines.push(
    `Alert feed: ${a.alerts.length} total (${Object.entries(bySev).map(([k, c]) => `${c} ${k}`).join(", ")}). Alert titles: ${a.alerts.slice(0, 12).map((al) => `[${al.severity}] ${al.title}`).join("; ")}.`
  );
  lines.push(
    `Composite index weights: EB rate ${a.weights.ebRate}, MSE-adjusted ${a.weights.mseAdjusted}, cluster ${a.weights.cluster}, ACLED trailing-12-month ${a.weights.acledRecent}, UCDP historical baseline ${a.weights.ucdpBaseline}, temporal ${a.weights.temporal}, vehicle ${a.weights.vehicle}.`
  );
  const f = a.forecast;
  lines.push(
    `Forecast: ${f.method} Backtest on real county-month panels (UCDP GED 2010-2022 joined to ACLED weekly aggregates 2023-2026): AUC ${f.backtest.auc}, Brier ${f.backtest.brier}, hit rate ${f.backtest.hitRate}, ${f.backtest.nPredictions} predictions, 95% interval coverage ${f.backtest.coverage95}. National 3-month enforced-disappearance forecast: ${f.national.forecastMonths.map((mm, i) => `${mm} mean ${f.national.mean[i]} (95% PI ${f.national.lower95[i]} to ${f.national.upper95[i]})`).join("; ")}. Recent national monthly series: ${f.national.series.slice(-6).map(p => `${p.month}: ${p.ed}`).join(", ")}.`
  );
  const tr = a.temporal.recent;
  if (tr.length) {
    lines.push(
      `Temporal anomalies (real Missing Voices monthly series, trailing 12-month baseline): ${tr.map(r => `${r.month}: ${r.ed} cases vs baseline ${r.baseline} (z ${r.z}${r.flagged ? ", FLAGGED" : ""})`).join("; ")}.`
    );
  }
  if (a.temporal.acledMonthly?.length) {
    lines.push(
      `ACLED national monthly corroborating series (abductions / VAC events, June 2024 onward): ${a.temporal.acledMonthly.map(p => `${p.month}: ${p.abductions}/${p.vacEvents}`).join(", ")}.`
    );
  }
  lines.push(
    `Data provenance: ${a.provenance.files.map(pf => `${pf.file} (${pf.rows} rows, ${pf.quality})`).join(", ")}.`
  );
  return lines.join("\n");
}

let digestCache: string | null = null;

async function buildDigest(): Promise<string> {
  if (digestCache) return digestCache;
  try {
    const analysis = await getKampsAnalysis();
    digestCache = renderDigest(analysis);
    return digestCache;
  } catch {
    return (
      "KAMPS ANALYSIS ENGINE CURRENTLY UNAVAILABLE. The underlying data layer " +
      "cannot be reached, so no zone counts, estimates, clusters, vehicle " +
      "assessments, or alerts can be quoted. State plainly that the data layer " +
      "does not cover the question right now and do not invent numbers."
    );
  }
}

// ———————————————————————————————————— route ————————————————————————————————————

const SYSTEM_PROMPT = [
  "You are the KAMPS analysis assistant for the Kenya Abduction Monitoring & Prediction System.",
  "You answer questions using ONLY the KAMPS data digest supplied in the user message.",
  "Rules:",
  "1. Answer only from the digest. If the digest does not contain the answer, say that the data layer does not cover it.",
  "2. Never speculate about individuals. Never name or imply any private individual as being at risk.",
  "3. Discuss risk only at aggregate zone level (sub-county zones and counties), never individual persons or households.",
  "4. Cite the exact numbers from the digest that you used in your answer.",
  "5. Keep answers under 200 words. No markdown headers, no bullet symbols, no tables. Plain sentences only.",
  "6. If asked about anything outside the digest (policy recommendations, legal advice, future events, real identities), decline and point to what the digest does cover.",
  "7. All figures come from real ingested datasets (Missing Voices, curated public-record incidents, KNCHR statements, KNBS 2019 census, UCDP GED 1989-2025); say so when quoting totals or estimates. Every vehicle record is publicly documented with sources.",
  "8. The zone list in the digest covers every monitored county. Never claim a county is uncovered unless it is genuinely absent from the list.",
].join(" ");

export async function POST(req: Request) {
  try {
    const { question } = (await req.json()) as { question?: string };
    if (!question || typeof question !== "string" || question.length > 500) {
      return Response.json({ error: "Invalid question" }, { status: 400 });
    }
    if (isRateLimited()) {
      return Response.json(
        { error: "Rate limit exceeded: maximum 10 questions per minute" },
        { status: 429 }
      );
    }

    const zai = await ZAI.create();
    const digest = await buildDigest();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `DATA DIGEST:\n${digest}\n\nQUESTION: ${question}` },
      ],
      thinking: { type: "disabled" },
    });

    return Response.json({
      answer: completion.choices[0]?.message?.content ?? "",
      asOf: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "Analyst unavailable" }, { status: 500 });
  }
}
