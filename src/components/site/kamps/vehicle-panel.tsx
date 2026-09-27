"use client";

import { motion } from "framer-motion";
import type { KampsAnalysis, VehicleAssessmentJSON } from "@/lib/kamps/engine";
import { vehicleRuleSpec } from "@/lib/kamps-content";
import { cn } from "@/lib/utils";
import { fmtDate } from "./ui";

const STATUS_STYLES = {
  flagged: "bg-[var(--accent-ink)] text-white",
  monitoring: "border border-dashed border-[var(--accent-ink)] text-[var(--accent-ink)]",
  cleared: "border border-border text-muted-foreground",
} as const;

const STATUS_LABEL = {
  flagged: "Flagged",
  monitoring: "Documented",
  cleared: "Cleared",
} as const;

function Timeline({
  vehicle,
  rangeStart,
  rangeEnd,
}: {
  vehicle: VehicleAssessmentJSON;
  rangeStart: number;
  rangeEnd: number;
}) {
  const W = 600, H = 52, X0 = 12, X1 = W - 12;
  const xFor = (t: number) => X0 + ((t - rangeStart) / (rangeEnd - rangeStart)) * (X1 - X0);
  const y = 30;

  // month ticks
  const ticks: { x: number; label: string }[] = [];
  const d = new Date(rangeStart);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() <= rangeEnd) {
    ticks.push({ x: xFor(d.getTime()), label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }

  const wStart = xFor(new Date(vehicle.windowStart).getTime());
  const wEnd = xFor(new Date(vehicle.windowEnd).getTime());

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Sighting timeline for ${vehicle.color} ${vehicle.make} ${vehicle.model}: ${vehicle.totalSightings} total sightings, best 30-day window highlighted`}
      className="mt-4 block h-auto w-full"
    >
      {/* window band */}
      <rect
        x={wStart}
        y={10}
        width={Math.max(3, wEnd - wStart)}
        height={34}
        rx={4}
        fill="var(--accent-ink)"
        fillOpacity={vehicle.status === "cleared" ? 0.05 : 0.08}
      />
      {/* baseline */}
      <line x1={X0} y1={y} x2={X1} y2={y} stroke="var(--border)" strokeWidth={1.5} />
      {/* month ticks */}
      {ticks.map(t => (
        <g key={t.label + t.x}>
          <line x1={t.x} y1={y - 4} x2={t.x} y2={y + 4} stroke="var(--border)" strokeWidth={1} />
          <text x={t.x} y={48} textAnchor="middle" style={{ font: "var(--font-geist-mono)", fontSize: 9, letterSpacing: "0.1em" }} className="fill-muted-foreground">
            {t.label}
          </text>
        </g>
      ))}
      {/* sightings */}
      {vehicle.sightings.map(s => {
        const inWindow =
          s.date >= vehicle.windowStart && s.date <= vehicle.windowEnd && vehicle.status !== "cleared";
        return (
          <circle
            key={s.id}
            cx={xFor(new Date(s.date).getTime())}
            cy={y}
            r={inWindow ? 5 : 4}
            fill={inWindow ? "var(--accent-ink)" : "var(--background)"}
            stroke={inWindow ? "var(--accent-ink)" : "var(--muted-foreground)"}
            strokeWidth={1.5}
          >
            <title>{`${fmtDate(s.date)} · ${s.zoneName} · ${s.source}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function VehicleCard({ vehicle, rangeStart, rangeEnd }: { vehicle: VehicleAssessmentJSON; rangeStart: number; rangeEnd: number }) {
  const flagged = vehicle.status === "flagged";
  return (
    <article className={cn("bg-background p-6 md:p-7", flagged && "border-l-2 border-l-[var(--accent-ink)]")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-medium tracking-[-0.01em] text-foreground">
            {vehicle.color} {vehicle.make} {vehicle.model}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Plate partial {vehicle.platePartial} · last seen {fmtDate(vehicle.lastSeen)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {vehicle.simulated && (
            <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/70 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Demo
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
              STATUS_STYLES[vehicle.status]
            )}
          >
            {STATUS_LABEL[vehicle.status]}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <div>
          <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">
            {vehicle.clusterSightings}
            <span className="text-sm text-muted-foreground"> / 30d</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sightings in window</p>
        </div>
        <div>
          <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{vehicle.incidentOverlap}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Co-located incidents</p>
        </div>
        <div>
          <p className="text-xl font-medium tracking-[-0.02em] text-foreground">{vehicle.zones.length}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Zones crossed</p>
        </div>
        <div>
          <p className="text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">
            {vehicle.confidence.toFixed(2)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Confidence</p>
        </div>
      </div>

      <Timeline vehicle={vehicle} rangeStart={rangeStart} rangeEnd={rangeEnd} />

      <p className="mt-3 text-sm leading-[1.6] text-muted-foreground">
        {vehicle.summary
          ? vehicle.summary
          : flagged
          ? `Meets the four-zone rule: ${vehicle.clusterSightings} sightings inside one 30-day window across ${vehicle.zones.join(", ")}, overlapping ${vehicle.incidentOverlap} documented incidents in time and space. Descriptor-level tracking only: no plate matching, no owner identification, no individuals.`
          : vehicle.status === "monitoring"
          ? "Density threshold met without incident overlap: monitored, not flagged. The rule deliberately requires both signals before escalation."
          : `${vehicle.totalSightings} total sightings spread over months: never ${vehicle.clusterSightings === 1 ? "reaches" : "reach"} the 30-day density threshold. Cleared.`}
      </p>
      {vehicle.sourceUrls && vehicle.sourceUrls.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">Sources</span>
          {vehicle.sourceUrls.slice(0, 3).map((u, i) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline decoration-border underline-offset-2 transition-colors hover:decoration-[var(--accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
            >
              {vehicle.sourceNames?.[i] ?? new URL(u).hostname}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}

export function VehiclePanel({ analysis }: { analysis: KampsAnalysis }) {
  const allDates = analysis.vehicles.flatMap(v => v.sightings.map(s => new Date(s.date).getTime()));
  const rangeStart = Math.min(...allDates);
  const rangeEnd = Math.max(...allDates, new Date(analysis.asOf).getTime());

  const flagged = analysis.vehicles.filter(v => v.status !== "cleared");
  const cleared = analysis.vehicles.filter(v => v.status === "cleared");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* rule spec strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {vehicleRuleSpec.map(spec => (
          <div key={spec.label} className="bg-background px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{spec.label}</p>
            <p className="mt-1.5 text-xl font-medium tabular-nums tracking-[-0.02em] text-foreground">{spec.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{spec.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-[1.6] text-muted-foreground">
        The four-zone rule is the civil-society analog of law-enforcement ANPR pattern analysis, turned
        toward state actors instead of citizens. A vehicle is flagged only when sighting density and
        incident overlap coincide. The first cards below are real, publicly documented pattern vehicles
        with their sources. Cards marked Demo carry a synthetic sighting log, clearly labeled, that
        exercises the rule end to end until the encrypted Tella field feed deploys in Phase 3.
      </p>

      {/* flagged + monitoring */}
      <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border">
        {flagged.map(v => (
          <VehicleCard key={v.vehicleKey} vehicle={v} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        ))}
      </div>

      {/* cleared */}
      {cleared.length > 0 && (
        <div className="mt-8">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Below threshold · the rule does not over-flag
          </p>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {cleared.map(v => (
              <div key={v.vehicleKey} className="bg-background p-5">
                <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground">
                  <span>{v.color} {v.make} {v.model}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {v.platePartial}
                  </span>
                </p>
                <p className="mt-1.5 text-sm leading-[1.6] text-muted-foreground">
                  {v.totalSightings} sightings over {v.sightings.length > 1
                    ? `${Math.round((new Date(v.sightings[v.sightings.length - 1].date).getTime() - new Date(v.sightings[0].date).getTime()) / 86400000)} days`
                    : "a single day"}: density threshold never met. Cleared.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
