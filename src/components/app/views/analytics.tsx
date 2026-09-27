"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import type { RiskBand } from "@/lib/kamps/stats";
import { BiasPanel } from "@/components/site/kamps/bias-panel";
import { RiskPanel } from "@/components/site/kamps/risk-panel";
import { AnalysisGate } from "../analysis-gate";
import { ViewHeader } from "../view-header";
import type { KampsState } from "../use-kamps";

export type ZoneForecast = {
  zoneId: number;
  zoneName: string;
  county: string;
  currentIndex: number;
  projectedIndex: number;
  band: RiskBand;
  trend?: number;
};

export type ForecastPayload = {
  generatedAt: string;
  horizonDays: number;
  method: string;
  projections: ZoneForecast[];
};

/** National series + prediction-interval chart (real Missing Voices data). */
function NationalForecastChart({ forecast }: { forecast: KampsAnalysis["forecast"] }) {
  const n = forecast.national;
  const series = n.series.map(p => p.ed);
  const all = [...series, ...n.mean];
  const lows = [...series.map(() => 0), ...n.lower95];
  const max = Math.max(4, ...n.upper95, ...all);
  const W = 720, H = 200, PAD_L = 34, PAD_R = 8, PAD_T = 14, PAD_B = 26;
  const total = series.length + n.mean.length;
  const x = (i: number) => PAD_L + (i / Math.max(total - 1, 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);

  const historyPath = series.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fcStart = series.length - 1;
  const meanPath = n.mean
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(fcStart + 1 + i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const bandPts = [
    ...n.mean.map((v, i) => `${x(fcStart + 1 + i).toFixed(1)},${y(n.upper95[i]).toFixed(1)}`),
    ...n.mean.map((v, i) => `${x(fcStart + 1 + n.mean.length - 1 - i).toFixed(1)},${y(n.lower95[n.mean.length - 1 - i]).toFixed(1)}`),
  ].join(" ");

  const monthTicks: Array<{ i: number; label: string }> = [];
  for (let i = 0; i < total; i += Math.ceil(total / 8)) {
    const label = i < series.length
      ? n.series[i].month
      : n.forecastMonths[i - series.length];
    monthTicks.push({ i, label: label.slice(2) });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`National enforced-disappearance monthly series with a three-month forecast and 95% prediction intervals: recent history ${series.slice(-6).join(", ")}, forecast ${n.mean.join(", ")}`}
      className="block h-auto w-full"
    >
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={PAD_L} x2={W - PAD_R} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeWidth={1} />
      ))}
      {[0, Math.round(max / 2), Math.round(max)].map(v => (
        <text key={v} x={PAD_L - 6} y={y(v) + 3} textAnchor="end" style={{ font: "var(--font-geist-mono)", fontSize: 9 }} className="fill-muted-foreground">
          {v}
        </text>
      ))}
      {/* 95% prediction band */}
      <polygon points={bandPts} fill="var(--accent-ink)" fillOpacity={0.08} />
      {/* history */}
      <path d={historyPath} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.75} />
      {/* connector */}
      <line x1={x(fcStart)} y1={y(series[fcStart])} x2={x(fcStart + 1)} y2={y(n.mean[0])} stroke="var(--accent-ink)" strokeWidth={1.75} strokeDasharray="3 3" />
      {/* forecast mean */}
      <path d={meanPath} fill="none" stroke="var(--accent-ink)" strokeWidth={1.75} strokeDasharray="5 4" />
      {/* last observed point */}
      <circle cx={x(fcStart)} cy={y(series[fcStart])} r={3} fill="var(--muted-foreground)" />
      {n.mean.map((v, i) => (
        <circle key={i} cx={x(fcStart + 1 + i)} cy={y(v)} r={3} fill="var(--accent-ink)" />
      ))}
      {/* x labels */}
      {monthTicks.map(t => (
        <text key={t.i} x={x(t.i)} y={H - 8} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 9, letterSpacing: "0.08em" }} className="fill-muted-foreground">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

function ForecastCard({ forecast, analysis }: { forecast: KampsAnalysis["forecast"]; analysis: KampsAnalysis }) {
  const bt = forecast.backtest;
  const rows = [...forecast.projections].sort((a, b) => b.projectedIndex - a.projectedIndex);
  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
          Forecast · {forecast.horizonDays}-day horizon
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          generated {forecast.generatedAt.slice(0, 10)}
        </p>
      </div>

      {/* national series + forecast */}
      <div className="border-b border-border p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            National enforced-disappearance series · Missing Voices, monthly
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent-ink)]">
            3-month forecast, 95% prediction band
          </p>
        </div>
        <NationalForecastChart forecast={forecast} />
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {forecast.national.forecastMonths.map((m, i) => (
            <p key={m} className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {m}:{" "}
              <span className="tabular-nums text-foreground">{forecast.national.mean[i]}</span>
              <span className="tabular-nums"> ({forecast.national.lower95[i]} to {forecast.national.upper95[i]})</span>
            </p>
          ))}
        </div>
        <p className="mt-3 text-sm leading-[1.6] text-muted-foreground">{forecast.method}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{bt.auc.toFixed(3)}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Backtest AUC</p>
          </div>
          <div>
            <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{bt.brier.toFixed(3)}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Brier score</p>
          </div>
          <div>
            <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{(bt.coverage95 * 100).toFixed(0)}%</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">PI coverage</p>
          </div>
          <div>
            <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{bt.nPredictions}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Out-of-sample n</p>
          </div>
        </div>
      </div>

      {/* county projections: table on desktop, stacked rows on mobile */}
      <div className="relative">
        <div className="matrix-scroll hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <caption className="sr-only">Projected composite index by county</caption>
          <thead>
            <tr className="border-b border-border">
              {["County", "Current", "Projected", "Change", "Band"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap bg-background px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta = r.projectedIndex - r.currentIndex;
              return (
                <tr key={r.zoneId} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                    {r.county}
                  </th>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.currentIndex.toFixed(1)}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground/85">{r.projectedIndex.toFixed(1)}</td>
                  <td className={`px-4 py-3 tabular-nums ${delta > 0.5 ? "text-[var(--accent-ink)]" : "text-muted-foreground"}`}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {r.band}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:hidden">
          {rows.map((r) => {
            const delta = r.projectedIndex - r.currentIndex;
            return (
              <li key={r.zoneId} className="flex items-center justify-between gap-3 bg-background px-4 py-3.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{r.county}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {r.band}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-foreground/85">
                  {r.currentIndex.toFixed(1)}
                  <span className="text-muted-foreground"> → </span>
                  <span className={delta > 0.5 ? "text-[var(--accent-ink)]" : "text-foreground"}>
                    {r.projectedIndex.toFixed(1)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="border-t border-border p-5 text-sm leading-[1.6] text-muted-foreground">
        Projections adjust each county&apos;s composite index by its forecasted organized-violence
        trend from walk-forward backtested UCDP panels, capped at 12 points. Counties without a
        forecastable trend hold their current index. {analysis.zones.length} counties monitored;
        the top {rows.length} by current index are listed.
      </p>
    </div>
  );
}

function PanelHeader({ kicker, note }: { kicker: string; note?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-[var(--accent-ink)]">/</span> {kicker}
      </p>
      {note ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function AnalyticsBody({ analysis }: { analysis: KampsAnalysis }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-12"
    >
      <section aria-label="Forecast">
        <PanelHeader kicker="Forecast" note="backtested, out-of-sample" />
        <ForecastCard forecast={analysis.forecast} analysis={analysis} />
      </section>

      <section aria-labelledby="analytics-bias">
        <h2 id="analytics-bias" className="sr-only">
          Bias correction
        </h2>
        <PanelHeader kicker="Bias correction" note="multiple systems estimation, two live lists" />
        <BiasPanel analysis={analysis} />
      </section>

      <section aria-labelledby="analytics-risk">
        <h2 id="analytics-risk" className="sr-only">
          Risk index
        </h2>
        <PanelHeader kicker="Risk index" note={`${analysis.zones.length} counties ranked by composite`} />
        <RiskPanel analysis={analysis} />
      </section>
    </motion.div>
  );
}

export function AnalyticsView({ kamps }: { kamps: KampsState }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="The statistics"
        title="Analytics"
        lede="Forecast, undercount, and the full 47-county ranking. The forecast is backtested walk-forward, not a straight line extended from hope, and the undercount comes from capture-recapture on two lists that do not talk to each other."
      />
      <AnalysisGate kamps={kamps}>{(analysis) => <AnalyticsBody analysis={analysis} />}</AnalysisGate>
    </div>
  );
}

export { Skeleton };
