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
  info: "Informational",
};

function KpiCell({
  value,
  label,
  accent = false,
  suffix,
}: {
  value: number;
  label: string;
  accent?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col bg-background p-6 pb-8 md:p-7 md:pb-9">
      <p className="text-4xl font-medium tabular-nums tracking-[-0.03em] md:text-5xl">
        <CountUp value={value} className={accent ? "text-[var(--accent-ink)]" : "text-foreground"} />
        {suffix ? (
          <span className={accent ? "text-[var(--accent-ink)]" : "text-foreground"}>{suffix}</span>
        ) : null}
      </p>
      <p className="mt-3 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

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

function TopZones({ analysis }: { analysis: KampsAnalysis }) {
  const zones = [...analysis.zones].sort((a, b) => b.index - a.index).slice(0, 5);
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Top 5 risk zones
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
            className="bg-background p-5"
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
    </div>
  );
}

function RecentAlerts({ analysis, onOpenAlerts }: { analysis: KampsAnalysis; onOpenAlerts: () => void }) {
  const recent = analysis.alerts.slice(0, 3);
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Recent alerts
        </p>
        <button
          type="button"
          onClick={onOpenAlerts}
          className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
        >
          View all {analysis.alerts.length} alerts ({analysis.overview.activeAlerts} action-level)
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
          System status
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          six-stage pipeline
        </p>
      </div>
      <ol className="flex flex-wrap gap-2">
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
        All six stages recompute on every refresh. Aggregate zone-level output only: the dashboard
        never displays individuals, plates, or case-level records.
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
        kicker="Operations"
        title="Monitoring dashboard"
        lede="Protective posture at a glance: bias-corrected totals, the zones that matter most, and the state of the six-stage pipeline. Auto-refreshes every 60 seconds while this tab is visible."
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
          {loading ? "fetching" : "refresh now"}
        </button>
      </div>

      {/* KPI row */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
        <KpiCell value={analysis.overview.documentedTotal} label="Documented incidents in the warehouse" />
        <KpiCell
          value={analysis.overview.estimatedTotal}
          label={`Adjusted true-total estimate (x${analysis.overview.underreportingFactor.toFixed(2)})`}
          accent
        />
        <KpiCell value={analysis.overview.significantClusters} label="Significant spatial clusters, pop-adjusted" />
        <KpiCell value={analysis.overview.documentedVehicles} label={`Documented vehicle patterns (${analysis.overview.flaggedVehicles} demo flags)`} />
      </dl>

      {/* zones + mini map */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
        <TopZones analysis={analysis} />

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              National coverage
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {analysis.overview.zones} zones · {monitoredCounties} counties
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <CountyRiskMap zones={analysis.zones} selectedKey={null} onSelect={onOpenMap} compact />
            <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
              Select a county to open the full risk map.{" "}
              {topZone
                ? `Current highest-risk zone: ${topZone.name} (${topZone.county}) at index ${topZone.index.toFixed(1)}.`
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
