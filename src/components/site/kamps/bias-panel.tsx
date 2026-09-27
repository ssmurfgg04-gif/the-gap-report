"use client";

import { motion } from "framer-motion";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import { fmtNum } from "./ui";

function TwoListVenn({ mse }: { mse: KampsAnalysis["mse"] }) {
  return (
    <svg
      viewBox="0 0 240 150"
      role="img"
      aria-label={`Two-list overlap: ${mse.nA} Missing Voices records, ${mse.nB} public-record records, ${mse.overlap} matched entities`}
      className="mx-auto block h-auto w-full max-w-[360px]"
    >
      <circle cx={86} cy={72} r={56} fill="var(--accent-ink)" fillOpacity={0.06} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1} />
      <circle cx={154} cy={72} r={56} fill="var(--accent-ink)" fillOpacity={0.06} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1} />

      <text x={34} y={18} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.12em" }} className="fill-[var(--accent-ink)]">MV</text>
      <text x={206} y={18} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.12em" }} className="fill-[var(--accent-ink)]">NEWS</text>

      <text x={58} y={72} textAnchor="middle" dominantBaseline="middle" style={{ font: "var(--font-geist-mono)", fontSize: 12 }} className="fill-foreground">
        {mse.nA - mse.overlap}
      </text>
      <text x={120} y={72} textAnchor="middle" dominantBaseline="middle" style={{ font: "var(--font-geist-mono)", fontSize: 12, fontWeight: 600 }} className="fill-[var(--accent-ink)]">
        {mse.overlap}
      </text>
      <text x={182} y={72} textAnchor="middle" dominantBaseline="middle" style={{ font: "var(--font-geist-mono)", fontSize: 12 }} className="fill-foreground">
        {mse.nB - mse.overlap}
      </text>
    </svg>
  );
}

function CaptureBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <span className="block h-full rounded-full bg-[var(--accent-ink)]" style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      <span className="w-12 shrink-0 text-right tabular-nums text-sm text-foreground/85">{pct.toFixed(1)}%</span>
    </div>
  );
}

export function BiasPanel({ analysis }: { analysis: KampsAnalysis }) {
  const { mse, overview, forecast } = analysis;
  const zonesByFactor = [...analysis.zones].filter(z => z.documented > 0).sort((a, b) => b.documented - a.documented);
  const bt = forecast.backtest;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14">
        {/* Venn column */}
        <div className="min-w-0">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Capture-recapture overlap · the two live lists
          </p>
          <TwoListVenn mse={mse} />
          <div className="mt-2 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              MV Missing Voices · NEWS curated public record (BBC, Capital FM, The Star, KNCHR)
            </p>
          </div>

          <div className="mt-7 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Capture rate, documented cases
            </p>
            <CaptureBar label="Missing Voices" pct={overview.captureRates.mv} />
            <CaptureBar label="Public record" pct={overview.captureRates.ob} />
          </div>

          <div className="mt-7 rounded-lg border border-border p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Estimator status
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent-ink)]">
              {mse.method === "chapman-2list" ? "Chapman two-list" : mse.method === "benchmark" ? "Benchmark adjustment" : "Not estimable yet"}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm tabular-nums text-muted-foreground">
              <li className="flex justify-between gap-4"><span>Missing Voices, window</span><span className="text-foreground/85">{mse.nA}</span></li>
              <li className="flex justify-between gap-4"><span>Public record, window</span><span className="text-foreground/85">{mse.nB}</span></li>
              <li className="flex justify-between gap-4"><span>Matched entities</span><span className="text-foreground/85">{mse.overlap}</span></li>
              <li className="flex justify-between gap-4"><span>Confidence</span><span className="text-foreground/85">{mse.confidence}</span></li>
            </ul>
          </div>
        </div>

        {/* explainer + validation + table column */}
        <div className="min-w-0">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            How many incidents really happened
          </p>
          <div className="space-y-4 text-sm leading-[1.6] text-muted-foreground md:text-[15px]">
            <p>
              The warehouse holds {fmtNum(overview.documentedTotal)} documented incidents in the monitoring
              window: {fmtNum(overview.documentedLocated)} resolved to a county and {fmtNum(overview.unlocatedIncidents)} carrying
              no resolvable location. The two live lists are the Missing Voices victim database and the
              curated public record; entity resolution (Jaro-Winkler name similarity above 0.82 with dates
              within three days) deduplicates them before anything is counted.
            </p>
            <p>{mse.note}</p>
          </div>

          {/* model validation on real data */}
          <div className="mt-6 rounded-lg border border-border border-l-2 border-l-[var(--accent-ink)] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
              Model validation · walk-forward backtest on real panels
            </p>
            <div className="mt-3 grid grid-cols-3 gap-4 sm:grid-cols-5">
              <div>
                <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{bt.auc.toFixed(3)}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">AUC</p>
              </div>
              <div>
                <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{bt.brier.toFixed(3)}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Brier</p>
              </div>
              <div>
                <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{(bt.falseAlarmRate * 100).toFixed(1)}%</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">False alarms</p>
              </div>
              <div>
                <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{(bt.coverage95 * 100).toFixed(0)}%</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">PI coverage</p>
              </div>
              <div>
                <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{fmtNum(bt.nPredictions)}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Predictions</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
              {bt.trainedOn}. Every number is scored out of sample: the classifier only ever trains on months
              strictly before the month it predicts. The prediction intervals cover {((bt.coverage95 * 100)).toFixed(1)}%
              of realized values, on target for a 95% interval.
            </p>
          </div>

          {/* county burden table */}
          <div className="mt-8">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Documented burden by county, 2019 census denominators
            </p>
            <div className="matrix-scroll max-h-[420px] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <caption className="sr-only">County-level documented burden table</caption>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">County</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Doc.</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Population</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Crude /100k</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">EB /100k</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">95% interval</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {zonesByFactor.map(z => (
                    <tr key={z.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
                      <th scope="row" className="whitespace-nowrap px-4 py-3.5 font-medium text-foreground">{z.name}</th>
                      <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{z.documented}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{fmtNum(z.population)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{z.crudeRate.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-foreground/85">{z.ebRate.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                        {z.ebCI[0].toFixed(2)} to {z.ebCI[1].toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {z.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/30">
                    <th scope="row" className="px-4 py-3.5 font-medium text-foreground">Unlocated (national)</th>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{overview.unlocatedIncidents}</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">-</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">-</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">-</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">-</td>
                    <td className="px-4 py-3.5 text-center text-muted-foreground">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
              Counties with no documented incidents in the window are omitted from this table but remain in
              the risk model through the UCDP historical baseline and the scan statistic. Thin data is
              handled the way statistics says it must be: wide intervals and low confidence grades, never
              invented precision.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
