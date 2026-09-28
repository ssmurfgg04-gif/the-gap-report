#!/usr/bin/env node
/**
 * KAMPS weekly digest: markdown summary for the auto-filed GitHub issue.
 *
 * Runs the full engine over the freshly ingested data, compares against the
 * previous week's snapshot (data/digest-state.json, committed to the repo),
 * and prints a digest to stdout. The GitHub Action files it as an issue
 * labeled weekly-digest, so every week leaves a searchable, permanent record
 * of what changed in the data.
 *
 * Usage: bun scripts/weekly-digest.mjs > digest.md
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getKampsAnalysis } from "../src/lib/kamps/engine";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, "data", "digest-state.json");

const a = await getKampsAnalysis();

// previous snapshot for deltas
let prev = null;
if (existsSync(STATE_FILE)) {
  try { prev = JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { /* fresh */ }
}
const delta = (field, cur) => {
  if (!prev || prev[field] === undefined || prev[field] === cur) return "";
  const d = cur - prev[field];
  return d > 0 ? ` (+${d} since last digest)` : d < 0 ? ` (${d} since last digest)` : "";
};

const o = a.overview;
const critical = a.zones.filter(z => z.band === "critical").length;
const elevated = a.zones.filter(z => z.band === "elevated").length;
const abd12 = a.zones.reduce((s, z) => s + z.acledAbductions12m, 0);
const vac12 = a.zones.reduce((s, z) => s + z.acledVacEvents12m, 0);
const nw = a.newsWatch;
const gdelt = a.media?.gdelt;
const spike = a.temporal.recent.filter(r => r.flagged).sort((x, y) => y.z - x.z)[0];
const actionAlerts = a.alerts.filter(al => al.severity === "critical" || al.severity === "elevated");

const L = [];
L.push(`# KAMPS weekly digest, ${new Date().toISOString().slice(0, 10)}`);
L.push("");
L.push(`Engine run over the data window ${a.dataWindow.start} to ${a.dataWindow.end}. Everything below comes from the ingested datasets; nothing is estimated where the data cannot support it.`);
L.push("");
L.push("## The numbers");
L.push("");
L.push(`- **${o.documentedTotal} documented incidents** in the monitoring window${delta("documentedTotal", o.documentedTotal)}, ${o.documentedLocated} county-located.`);
L.push(`- Capture-recapture: ${a.mse.method === "chapman-2list" ? `estimated ${o.estimatedTotal} total (CI ${o.estimateCI[0]} to ${o.estimateCI[1]})` : "not estimable (list overlap still zero; police and mortuary lists pending ATI requests)"}.`);
L.push(`- Zones: ${critical} critical, ${elevated} elevated. Highest: ${o.highestZone} at index ${o.highestIndex}.`);
L.push(`- ACLED trailing 12 months: ${abd12} abduction-coded events, ${vac12} violence-against-civilians events${delta("abd12", abd12)}.`);
if (spike) L.push(`- Temporal: ${spike.month} flagged at z +${spike.z.toFixed(1)} (${spike.ed} cases vs ${spike.baseline} baseline).`);
if (gdelt?.status === "ok" && gdelt.monthly.length) {
  const last = gdelt.monthly.at(-1);
  L.push(`- GDELT media volume: ${last.volume} matching articles in ${last.month} (attention, not incidence).`);
}
L.push("");
L.push("## What moved this week");
L.push("");
if (nw) {
  L.push(`- News watch: ${nw.total} matched articles in the trailing 60 days, ${nw.last7d} in the last 7 days against a ${nw.weeklyBaseline}/week baseline.`);
  if (nw.knchr.newSinceLastRun) {
    L.push(`- KNCHR published ${nw.knchr.newSinceLastRun} new statement(s) since the last sweep (index now through id ${nw.knchr.latestId}).`);
  } else {
    L.push(`- KNCHR statement index unchanged through id ${nw.knchr.latestId}.`);
  }
} else {
  L.push("- News watch data not present this run.");
}
if (prev) {
  const changed = [];
  if (prev.documentedTotal !== o.documentedTotal) changed.push(`documented incidents ${prev.documentedTotal} -> ${o.documentedTotal}`);
  if (prev.abd12 !== abd12) changed.push(`ACLED 12-month abductions ${prev.abd12} -> ${abd12}`);
  if (prev.knchrLatestId !== undefined && nw && prev.knchrLatestId !== nw.knchr.latestId) changed.push(`KNCHR index ${prev.knchrLatestId} -> ${nw.knchr.latestId}`);
  L.push(changed.length ? `- Deltas: ${changed.join("; ")}.` : "- No tracked totals moved.");
}
L.push("");
L.push("## Curator queue");
L.push("");
{
  const QFILE = path.join(ROOT, "data", "curation-queue.json");
  let q = null;
  try { q = JSON.parse(readFileSync(QFILE, "utf8")); } catch { /* watcher did not run */ }
  if (q?.queue && Object.keys(q.queue).length) {
    const cases = Object.values(q.queue);
    const by = (s) => cases.filter(c => c.status === s).length;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const ready = cases.filter(c => c.status === "ready");
    const promoted = cases.filter(c => c.status === "promoted" && (c.promotedAt ?? "") >= weekAgo);
    const pending = cases.filter(c => c.status === "pending"
      && (c.latestPubDate ?? c.pubDate) >= new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10));
    L.push(`Queue watcher (data/curation-queue.json, persistent): ${by("promoted")} promoted all-time, ${by("duplicate")} held out as already-documented, ${by("pending")} pending single-source leads.`);
    L.push("");
    L.push(`**Ready: ${by("ready")} case(s) one verification away from entering the documented count** (2+ independent outlets corroborate; a human confirms the facts, then promotes):`);
    for (const r of ready.slice(0, 6)) {
      L.push(`- [READY · ${r.corroboration} outlets] ${r.person ?? r.incidentHint} — ${r.incidentHint} (${r.outlets.join(", ")}, ${r.pubDate})`);
    }
    if (!ready.length) L.push("- None waiting on corroboration right now.");
    if (promoted.length) {
      L.push("");
      L.push("Promoted into the documented record this week (counted, sourced, cross-verified):");
      for (const p of promoted.slice(0, 6)) {
        L.push(`- ${p.person ?? p.incidentHint} (${p.pubDate}) — ${p.corroboration}+ outlets; record id ${p.promotedRecordId}`);
      }
    }
    if (pending.length) {
      L.push("");
      L.push("Fresh single-source leads (not corroborated yet; nothing below is counted):");
      for (const p of pending.slice(0, 8)) {
        L.push(`- [${p.source ?? "lead"}] ${p.incidentHint} (${p.outlets.join(", ")}, ${p.latestPubDate ?? p.pubDate})`);
      }
    }
  } else if (nw) {
    L.push("Candidates from the discovery layer. A human verifies each against a second source, then promotes verified cases into data/incidents-public-record.json with their source URLs. Nothing below is counted yet.");
    L.push("");
    const candidates = nw.articles
      .filter(x => x.pubDate >= new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10))
      .filter(x => /abduct|kidnap|disappear|missing|dumped|found/i.test(x.title))
      .slice(0, 12);
    if (candidates.length) {
      for (const c of candidates) L.push(`- [${c.title}](${c.url}) (${c.source}, ${c.pubDate})`);
    } else {
      L.push("- No fresh candidates in the trailing 9 days.");
    }
  } else {
    L.push("- News watch unavailable.");
  }
}
L.push("");
L.push("## Action-level alerts");
L.push("");
for (const al of actionAlerts.slice(0, 20)) L.push(`- **[${al.severity.toUpperCase()}]** ${al.title}`);
if (actionAlerts.length === 0) L.push("- None.");
L.push("");
L.push("## Election clock");
L.push("");
if (a.context) L.push(`${a.context.monthsToElection} months to the ${a.context.nextElection} general election. ${a.context.note}`);
L.push("");
L.push("---");
L.push("Generated by the weekly GitHub Action (`.github/workflows/weekly-ingest.yml`): ACLED Monday file, GDELT volume, news watch sweep, curation queue watch, Missing Voices refresh, engine regression guard. Data diffs are committed; this issue is the human-readable record. Partners get the headline numbers via the DIGEST_WEBHOOK_URL ping; ask a repo admin to add your channel's webhook to the repo secrets.");
L.push("");

const md = L.join("\n");

// snapshot for next week's deltas (skipped in dry-run so local previews do
// not consume the delta)
if (process.env.KAMPS_DRY_RUN !== "1") {
  writeFileSync(STATE_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    documentedTotal: o.documentedTotal,
    estimatedTotal: o.estimatedTotal,
    abd12,
    vac12,
    critical,
    elevated,
    knchrLatestId: nw?.knchr.latestId ?? null,
    newsLast7d: nw?.last7d ?? null,
  }, null, 2));
}

process.stdout.write(md);
console.error(
  `digest written (${L.length} lines); ` +
  (process.env.KAMPS_DRY_RUN === "1" ? "dry-run: state snapshot NOT updated." : "state snapshot updated.")
);
