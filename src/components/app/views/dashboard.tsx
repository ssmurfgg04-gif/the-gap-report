"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import { pipeline } from "@/lib/kamps-content";
import { BandChip } from "@/components/site/kamps/ui";
import { CountUp } from "../kpi-count-up";
import { CountyRiskMap } from "../county-map";
import { EngineErrorCard, ViewSkeleton } from "../analysis-gate";
import { ViewHeader } from "../view-header";
import type { KampsState } from "../use-kamps";

type Severity = "critical" | "elevated" | "watch" | "info";

const SEV_STYLES: Record<Severity, string> = {
  critical: "bg-[var(--accent-ink)] text-white",
  elevated: "border border-[var(--accent-ink)] text-[var(--accent-ink)]",
  watch: "border border-dashed border-[var(--accent-ink)]/70 text-[var(--accent-ink)]/90",
  info: "border border-border text-muted-foreground",
};

const SEV_LABEL: Record<Severity, string> = {
  critical: "Critical",
  elevated: "Elevated",
  watch: "Watch",
  info: "Info",
};

/** Ticking Nairobi clock + data-as-of line. Renders a placeholder until mounted. */
function LiveClock({ asOf }: { asOf: string }) {
  const [clock, setClock] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour12: false });
    const tick = () => setClock(fmt());
    const id0 = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(id0); window.clearInterval(id); };
  }, []);
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      data as of {asOf.slice(0, 10)} · Nairobi {clock ?? "--:--:--"}
    </p>
  );
}

/** Brief "updated" chip that appears after a successful background refresh. */
function UpdatedFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-ink)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]"
        >
          <span className="h-1 w-1 rounded-full bg-[var(--accent-ink)]" aria-hidden="true" />
          updated
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Primary stat: one number worth the whole screen, estimate directly under it. */
function HeadlineStat({ analysis }: { analysis: KampsAnalysis }) {
  const o = analysis.overview;
  return (
    <div className="flex flex-col justify-between gap-8 bg-background p-6 pb-8 md:p-8 md:pb-10">
      <div>
        <p className="font-mono text-[10px] uppercase leading-[1.6] tracking-[0.16em] text-muted-foreground">
          Documented incidents since June 2024
        </p>
        <p className="mt-4 text-6xl font-medium tabular-nums tracking-[-0.04em] text-foreground md:text-7xl">
          <CountUp value={o.documentedTotal} />
        </p>
        <p className="mt-3 max-w-md text-sm leading-[1.6] text-muted-foreground">
          Deduplicated by entity resolution. Each one is a person with a name and a source
          URL. {o.unlocatedIncidents > 0 ? `${o.unlocatedIncidents} of them carry no resolvable county.` : ""}
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[var(--accent-ink)]/60 bg-[var(--accent-ink)]/[0.03] p-5">
        {analysis.mse.method === "not-estimable" ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                the floor, not the number
              </span>
            </p>
            <p className="mt-2.5 text-sm leading-[1.6] text-muted-foreground">
              Capture-recapture cannot run yet: the two live lists share zero matched cases,
              and the method needs overlap to see the unseen. The police occurrence-book and
              mortuary lists that would fix this are pending Access to Information requests.
              Treat the documented count as the floor.
            </p>
          </>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-medium tabular-nums tracking-[-0.03em] text-[var(--accent-ink)]">
                <CountUp value={o.estimatedTotal} />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                estimated true total
              </span>
            </p>
            <p className="mt-2.5 text-sm leading-[1.6] text-muted-foreground">
              Capture-recapture on two independent lists, so the number to plan around is
              higher than the number you can cite. Interval {o.estimateCI[0]} to {o.estimateCI[1]}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SideStat({
  value,
  label,
  note,
}: {
  value: number | string;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 bg-background px-6 py-5 md:px-7">
      <p className="min-w-0">
        <span className="font-mono text-[10px] uppercase leading-[1.6] tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {note ? (
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {note}
          </span>
        ) : null}
      </p>
      <p className="shrink-0 text-3xl font-medium tabular-nums tracking-[-0.03em] text-foreground">
        {value}
      </p>
    </div>
  );
}

function TopZones({ analysis }: { analysis: KampsAnalysis }) {
  const zones = [...analysis.zones].sort((a, b) => b.index - a.index).slice(0, 5);
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Where risk holds up
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          composite index, 0 to 100
        </p>
      </div>
      <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border">
        {zones.map((z, i) => (
          <motion.li
            key={z.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
            className="bg-background p-5 transition-colors duration-150 hover:bg-foreground/[0.02]"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-mono text-[11px] tabular-nums text-[var(--accent-ink)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="font-medium text-foreground">{z.name}</p>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {z.county}
              </span>
              <span className="ml-auto tabular-nums text-foreground">{z.index.toFixed(1)}</span>
              <BandChip band={z.band} />
            </div>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, z.index)}%` }}
                transition={{ duration: 0.7, delay: 0.15 + Math.min(i * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
                className="block h-full rounded-full bg-[var(--accent-ink)]"
              />
            </span>
          </motion.li>
        ))}
      </ol>
      <p className="mt-3 text-sm leading-[1.6] text-muted-foreground">
        Scores correct for population and reporting bias. A county does not make this list
        just for being big or loud; it has to be statistically hot after adjustment.
      </p>
    </div>
  );
}

function RecentAlerts({ analysis, onOpenAlerts }: { analysis: KampsAnalysis; onOpenAlerts: () => void }) {
  const recent = analysis.alerts.slice(0, 3);
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Latest signals
        </p>
        <button
          type="button"
          onClick={onOpenAlerts}
          className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
        >
          All {analysis.alerts.length} alerts
        </button>
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border">
        {recent.map((a) => (
          <article
            key={a.id}
            className={`bg-background p-5 ${
              a.severity === "critical" || a.severity === "elevated"
                ? "border-l-2 border-l-[var(--accent-ink)]"
                : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${SEV_STYLES[a.severity]}`}
              >
                {SEV_LABEL[a.severity]}
              </span>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-foreground">{a.title}</p>
            </div>
            <p className="mt-2.5 line-clamp-2 text-sm leading-[1.6] text-muted-foreground">{a.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function PipelineStrip({ live }: { live: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Engine status
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          six stages, recomputed on refresh
        </p>
      </div>
      <ol className="flex flex-wrap gap-2 gap-y-2.5">
        {pipeline.map((s, i) => (
          <motion.li
            key={s.stage}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
              live ? "border-border text-foreground" : "border-border/60 text-muted-foreground/60"
            }`}
            title={s.output}
          >
            {live ? (
              <Check className="h-3 w-3 text-[var(--accent-ink)]" aria-hidden="true" />
            ) : (
              <span className="h-3 w-3 rounded-full border border-border" aria-hidden="true" />
            )}
            <span className="tabular-nums text-[var(--accent-ink)]">{s.stage}</span>
            {s.name}
            {live && i === pipeline.length - 1 ? (
              <span className="relative ml-1 flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-ink)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)]" />
              </span>
            ) : null}
          </motion.li>
        ))}
      </ol>
      <p className="mt-4 max-w-2xl text-sm leading-[1.6] text-muted-foreground">
        Zone-level aggregate output only. The dashboard never shows individuals, plates, or
        case-level records.
      </p>
    </div>
  );
}

export function DashboardView({
  kamps,
  onOpenMap,
  onNavigate,
}: {
  kamps: KampsState;
  onOpenMap: (countyKey: string | null) => void;
  onNavigate: (view: "alerts") => void;
}) {
  const [flash, setFlash] = useState(false);
  const prevTs = useRef<number | null>(null);

  useEffect(() => {
    if (kamps.updatedAt == null) return;
    if (prevTs.current != null && kamps.updatedAt !== prevTs.current) {
      const id0 = window.setTimeout(() => setFlash(true), 0);
      const id = window.setTimeout(() => setFlash(false), 2400);
      prevTs.current = kamps.updatedAt;
      return () => { window.clearTimeout(id0); window.clearTimeout(id); };
    }
    prevTs.current = kamps.updatedAt;
  }, [kamps.updatedAt]);

  const monitoredCounties = kamps.analysis
    ? new Set(kamps.analysis.zones.map((z) => z.county.toLowerCase().replace(/[^a-z0-9]/g, ""))).size
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="Kenya, live"
        title="The count, corrected"
        lede={
          kamps.analysis && kamps.analysis.mse.method !== "not-estimable"
            ? "Every number here traces to a source you can open. The documented count is the floor, not the number; capture-recapture puts the true total higher. Risk scores adjust for population and reporting bias, so a county cannot top this list just by being big. Refreshes every 60 seconds while the tab is open."
            : "Every number here traces to a source you can open. The documented count is the floor; the undercount estimate is pending a third list. Risk scores adjust for population and reporting bias, so a county cannot top this list just by being big. Refreshes every 60 seconds while the tab is open."
        }
      />

      {kamps.error && <EngineErrorCard error={kamps.error} />}
      {!kamps.error && !kamps.analysis && <ViewSkeleton />}

      {kamps.analysis && (
        <DashboardBody
          analysis={kamps.analysis}
          flash={flash}
          loading={kamps.loading}
          monitoredCounties={monitoredCounties}
          onOpenMap={onOpenMap}
          onRefresh={kamps.refresh}
          onOpenAlerts={() => onNavigate("alerts")}
        />
      )}
    </div>
  );
}

function DashboardBody({
  analysis,
  flash,
  loading,
  monitoredCounties,
  onOpenMap,
  onRefresh,
  onOpenAlerts,
}: {
  analysis: KampsAnalysis;
  flash: boolean;
  loading: boolean;
  monitoredCounties: number;
  onOpenMap: (countyKey: string | null) => void;
  onRefresh: () => void;
  onOpenAlerts: () => void;
}) {
  const topZone = [...analysis.zones].sort((a, b) => b.index - a.index)[0];
  const o = analysis.overview;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* status strip */}
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2">
        <LiveClock asOf={analysis.asOf} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          auto-refresh 60s
        </span>
        <UpdatedFlash show={flash} />
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto inline-flex min-h-[36px] items-center gap-2 rounded-full border border-border px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-[var(--accent-ink)]" : "bg-border"}`}
            aria-hidden="true"
          />
          {loading ? "fetching" : "refresh"}
        </button>
      </div>

      {/* headline stat + side rail */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <HeadlineStat analysis={analysis} />
        <div className="grid gap-px bg-border">
          <SideStat
            value={analysis.mse.method === "not-estimable" ? "x1.00" : `x${o.underreportingFactor.toFixed(2)}`}
            label="Underreporting factor"
            note={analysis.mse.method === "not-estimable" ? "not yet estimable, unadjusted" : "estimate over documented"}
          />
          <SideStat
            value={o.significantClusters}
            label="Significant clusters"
            note="population-adjusted"
          />
          <SideStat
            value={o.documentedVehicles}
            label="Pattern vehicles"
            note="publicly documented"
          />
          <SideStat value={monitoredCounties} label="Counties scored" note="of 47" />
        </div>
      </div>

      {/* zones + mini map */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
        <TopZones analysis={analysis} />

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              National picture
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {analysis.overview.zones} zones · {monitoredCounties} counties
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <CountyRiskMap zones={analysis.zones} selectedKey={null} onSelect={onOpenMap} compact />
            <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
              Tap a county to open the full map.{" "}
              {topZone
                ? `Hottest right now: ${topZone.name} (${topZone.county}) at index ${topZone.index.toFixed(1)}.`
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* alerts + pipeline */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
        <RecentAlerts analysis={analysis} onOpenAlerts={onOpenAlerts} />
        <PipelineStrip live />
      </div>
    </motion.div>
  );
}
