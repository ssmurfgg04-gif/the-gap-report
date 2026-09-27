"use client";

import { motion } from "framer-motion";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import { KenyaRiskMap } from "./kenya-map";
import { BandChip, ConfChip, fmtNum, pValue } from "./ui";

export function RiskPanel({ analysis }: { analysis: KampsAnalysis }) {
  const zones = [...analysis.zones].sort((a, b) => b.index - a.index);
  const rrFor = (id: number) => analysis.clusters.find(c => c.zoneIds.includes(id) && c.p <= 0.05);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14">
        {/* map column */}
        <div className="min-w-0">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Composite risk by sub-county
          </p>
          <KenyaRiskMap zones={analysis.zones} clusters={analysis.clusters} />
          <p className="mt-5 text-sm leading-[1.6] text-muted-foreground">
            Marker position is the sub-county centroid. Dashed halos mark statistically
            significant scan clusters, population-adjusted. Turkana Central documents
            only 16 cases, yet carries the strongest excess once population and
            underreporting are corrected: that correction is the point of the system.
          </p>

          <div className="mt-6 rounded-lg border border-border p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
              Index composition
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex justify-between gap-4">
                <span>EB-smoothed rate</span>
                <span className="tabular-nums text-foreground/85">{Math.round(analysis.weights.ebRate * 100)}%</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>MSE-adjusted rate</span>
                <span className="tabular-nums text-foreground/85">{Math.round(analysis.weights.mseAdjusted * 100)}%</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Cluster excess</span>
                <span className="tabular-nums text-foreground/85">{Math.round(analysis.weights.cluster * 100)}%</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Temporal deviation</span>
                <span className="tabular-nums text-foreground/85">{Math.round(analysis.weights.temporal * 100)}%</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Vehicle signal</span>
                <span className="tabular-nums text-foreground/85">{Math.round(analysis.weights.vehicle * 100)}%</span>
              </li>
            </ul>
          </div>
        </div>

        {/* table column */}
        <div className="min-w-0">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            All twelve zones, ranked by composite index
          </p>
          <div className="matrix-scroll max-h-[520px] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">Zone risk assessment table, ranked by composite index</caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border">
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Zone</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Index</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Band</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Doc.</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">EB /100k</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">MSE est.</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cluster</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Temporal</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Veh.</th>
                  <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => {
                  const cluster = rrFor(z.id);
                  return (
                    <tr
                      key={z.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <th scope="row" className="whitespace-nowrap px-4 py-3.5 align-top font-medium text-foreground">
                        <span className="block">{z.name}</span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {z.county}
                        </span>
                      </th>
                      <td className="px-4 py-3.5 align-top">
                        <span className="flex items-center gap-2.5">
                          <span className="tabular-nums text-foreground">{z.index.toFixed(1)}</span>
                          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-border" aria-hidden="true">
                            <span
                              className="block h-full rounded-full bg-[var(--accent-ink)]"
                              style={{ width: `${Math.min(100, z.index)}%` }}
                            />
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top"><BandChip band={z.band} /></td>
                      <td className="px-4 py-3.5 text-right align-top tabular-nums text-foreground/85">{z.documented}</td>
                      <td className="px-4 py-3.5 text-right align-top tabular-nums text-muted-foreground">{z.ebRate.toFixed(1)}</td>
                      <td className="px-4 py-3.5 text-right align-top tabular-nums text-muted-foreground">
                        {fmtNum(z.mseEstimated)}
                        <span className="block text-[11px] text-muted-foreground/80">x{z.mseFactor.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right align-top tabular-nums">
                        {cluster ? (
                          <span className="text-foreground/85">
                            RR {cluster.rr.toFixed(2)}
                            <span className="block text-[11px] text-[var(--accent-ink)]">{pValue(cluster.p)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/70">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top tabular-nums text-muted-foreground">
                        <span className={z.temporalFlagged ? "text-[var(--accent-ink)]" : ""}>
                          {z.temporalZ >= 0 ? "+" : ""}{z.temporalZ.toFixed(1)}&sigma;
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center align-top">
                        {z.vehicleSignal ? (
                          <span className="mx-auto block h-2 w-2 rounded-full bg-[var(--accent-ink)]" aria-label="flagged vehicle activity" />
                        ) : (
                          <span className="mx-auto block h-2 w-2 rounded-full border border-border" aria-hidden="true" />
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top"><ConfChip level={z.confidence} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
            Doc. = documented incidents in the warehouse. EB = Empirical Bayes smoothed rate.
            MSE est. = capture-recapture adjusted total (factor relative to documented).
            Temporal = z-score against the zone&apos;s own rolling 90-day baseline.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
