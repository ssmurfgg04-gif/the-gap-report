"use client";

import { motion } from "framer-motion";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import { fmtNum } from "./ui";

function Venn({ mse }: { mse: KampsAnalysis["mse"] }) {
  // exclusive region counts
  const pairMV_OB = mse.mvOb - mse.allThree;
  const pairMV_Mort = mse.mvMort - mse.allThree;
  const pairOB_Mort = mse.obMort - mse.allThree;

  const t = (x: number, y: number, label: number | string, strong = false) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="fill-foreground"
      style={{ font: "var(--font-geist-mono)", fontSize: 11, fontWeight: strong ? 600 : 400, opacity: strong ? 1 : 0.85 } as React.CSSProperties}
    >
      {label}
    </text>
  );

  return (
    <svg
      viewBox="0 0 230 210"
      role="img"
      aria-label={`Source overlap Venn diagram: Missing Voices ${mse.onlyMV} exclusive, Police occurrence book ${mse.onlyOB} exclusive, mortuary ${mse.onlyMort} exclusive, ${mse.allThree} in all three`}
      className="mx-auto block h-auto w-full max-w-[330px]"
    >
      <circle cx={76} cy={72} r={58} fill="var(--accent-ink)" fillOpacity={0.05} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1} />
      <circle cx={144} cy={72} r={58} fill="var(--accent-ink)" fillOpacity={0.05} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1} />
      <circle cx={110} cy={130} r={58} fill="var(--accent-ink)" fillOpacity={0.05} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1} />

      {/* circle labels */}
      <text x={38} y={16} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.12em" }} className="fill-[var(--accent-ink)]">MV</text>
      <text x={182} y={16} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.12em" }} className="fill-[var(--accent-ink)]">OB</text>
      <text x={110} y={196} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.12em" }} className="fill-[var(--accent-ink)]">MORT</text>

      {/* region counts */}
      {t(52, 54, mse.onlyMV, true)}
      {t(168, 54, mse.onlyOB)}
      {t(110, 152, mse.onlyMort)}
      {t(110, 60, pairMV_OB)}
      {t(74, 108, pairMV_Mort)}
      {t(146, 108, pairOB_Mort)}
      {t(110, 92, mse.allThree, true)}
    </svg>
  );
}

function CaptureBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <span className="block h-full rounded-full bg-[var(--accent-ink)]" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-12 shrink-0 text-right tabular-nums text-sm text-foreground/85">{pct.toFixed(1)}%</span>
    </div>
  );
}

export function BiasPanel({ analysis }: { analysis: KampsAnalysis }) {
  const { mse, overview, groundTruth } = analysis;
  const zonesByFactor = [...analysis.zones].sort((a, b) => b.mseFactor - a.mseFactor);
  const missPct = groundTruth
    ? Math.abs(overview.estimatedTotal - groundTruth) / groundTruth * 100
    : null;

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
            Capture-recapture overlap · the three lists
          </p>
          <Venn mse={mse} />
          <div className="mt-2 space-y-1.5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              MV Missing Voices · OB Police occurrence book · MORT Mortuary registries
            </p>
          </div>

          <div className="mt-7 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Capture rate, documented cases
            </p>
            <CaptureBar label="Missing Voices" pct={overview.captureRates.mv} />
            <CaptureBar label="Police OB" pct={overview.captureRates.ob} />
            <CaptureBar label="Mortuary" pct={overview.captureRates.mort} />
          </div>

          <div className="mt-7 rounded-lg border border-border p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Pairwise cross-checks · Chapman
            </p>
            <ul className="mt-3 space-y-1.5 text-sm tabular-nums text-muted-foreground">
              <li className="flex justify-between gap-4"><span>MV x OB</span><span className="text-foreground/85">{mse.pairMV_OB ?? "no overlap"}</span></li>
              <li className="flex justify-between gap-4"><span>MV x MORT</span><span className="text-foreground/85">{mse.pairMV_Mort ?? "no overlap"}</span></li>
              <li className="flex justify-between gap-4"><span>OB x MORT</span><span className="text-foreground/85">{mse.pairOB_Mort ?? "no overlap"}</span></li>
            </ul>
          </div>
        </div>

        {/* explainer + table column */}
        <div className="min-w-0">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            How many incidents really happened
          </p>
          <div className="space-y-4 text-sm leading-[1.6] text-muted-foreground md:text-[15px]">
            <p>
              The warehouse holds {mse.documented} verified incidents: the union of what the three
              lists captured. But lists miss cases. Multiple Systems Estimation treats each list as a
              capture event and estimates the unseen total from the overlap structure, the same method
              the Human Rights Data Analysis Group applied to conflict mortality records. Two lists that
              overlap heavily catch similar cases; lists that barely overlap reveal a larger hidden
              population.
            </p>
            <p>
              The stratified estimate: <span className="font-medium text-foreground">{fmtNum(overview.estimatedTotal)}</span>{" "}
              total incidents against {fmtNum(overview.documentedTotal)} documented, an underreporting
              factor of {overview.underreportingFactor.toFixed(2)}x. The pooled national estimator
              returns {fmtNum(overview.pooledEstimate)}: it undershoots because capture probability
              differs sharply between urban and rural zones, so the engine estimates per zone and sums.
            </p>
          </div>

          {groundTruth != null && (
            <div className="mt-6 rounded-lg border border-border border-l-2 border-l-[var(--accent-ink)] p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
                Estimator check · simulation ground truth
              </p>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{fmtNum(groundTruth)}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">generated</p>
                </div>
                <div>
                  <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{fmtNum(overview.estimatedTotal)}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">estimated</p>
                </div>
                <div>
                  <p className="text-2xl font-medium tabular-nums tracking-[-0.02em] text-[var(--accent-ink)]">
                    {missPct != null ? `${missPct.toFixed(1)}%` : "-"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">error</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
                The engine never sees the truth value; the number it recovers is a pure product of the
                statistics. The bootstrap interval below the table covers sampling uncertainty only:
                positive dependence between lists would widen it further, which is why the alert layer
                treats every estimate as a floor, not a point.
              </p>
            </div>
          )}

          <div className="mt-8">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Underreporting by zone, widest first
            </p>
            <div className="matrix-scroll overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="sr-only">MSE underreporting estimates by zone</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Zone</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Documented</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Estimated</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">95% interval</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Factor</th>
                    <th scope="col" className="whitespace-nowrap bg-background px-4 py-3.5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {zonesByFactor.map(z => (
                    <tr key={z.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
                      <th scope="row" className="whitespace-nowrap px-4 py-3.5 font-medium text-foreground">{z.name}</th>
                      <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{z.documented}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-foreground/85">{fmtNum(z.mseEstimated)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                        {z.mseCI[0]} to {z.mseCI[1]}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className={z.mseFactor >= 1.4 ? "text-[var(--accent-ink)]" : "text-foreground/85"}>
                          x{z.mseFactor.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {z.mseConfidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
              Turkana Central and Naivasha carry the widest intervals: thin data plus heterogeneous
              capture. The alert layer flags exactly these zones for prioritized field collection,
              because that is where documentation, not analysis, is the bottleneck.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
