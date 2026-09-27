"use client";

import { useState } from "react";
import { KENYA_VIEWBOX, KENYA_OUTLINE_PATH, projectKenya } from "@/lib/kenya-map";
import type { ZoneAssessment } from "@/lib/kamps/engine";
import type { RiskBand } from "@/lib/kamps/stats";
import { BAND_LABELS } from "./ui";

type HoverState = { zone: ZoneAssessment; x: number; y: number } | null;

const dotFor = (band: RiskBand): { fill: string; stroke: string; opacity: number } => {
  switch (band) {
    case "critical":
      return { fill: "var(--accent-ink)", stroke: "var(--accent-ink)", opacity: 1 };
    case "elevated":
      return { fill: "var(--accent-ink)", stroke: "var(--accent-ink)", opacity: 0.8 };
    case "watch":
      return { fill: "var(--accent-ink)", stroke: "var(--accent-ink)", opacity: 0.3 };
    default:
      return { fill: "var(--background)", stroke: "var(--muted-foreground)", opacity: 0.9 };
  }
};

export function KenyaRiskMap({
  zones,
  clusters,
}: {
  zones: ZoneAssessment[];
  clusters: { zoneIds: number[]; rr: number; p: number }[];
}) {
  const [hover, setHover] = useState<HoverState>(null);
  const zoneById = new Map(zones.map(z => [z.id, z]));

  return (
    <div className="relative">
      <svg
        viewBox={KENYA_VIEWBOX}
        role="img"
        aria-label={`Kenya risk map: ${zones.length} sub-county markers colored by composite risk band, with dashed halos marking statistically significant clusters`}
        className="mx-auto block h-auto w-full max-w-[400px]"
      >
        <path
          d={KENYA_OUTLINE_PATH}
          fill="var(--muted)"
          fillOpacity={0.45}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeOpacity={0.6}
        />

        {/* cluster halos */}
        {clusters
          .filter(c => c.p <= 0.05)
          .map(c => {
            const pts = c.zoneIds
              .map(id => zoneById.get(id))
              .filter(Boolean)
              .map(z => projectKenya(z!.lat, z!.lng));
            if (pts.length === 0) return null;
            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            const r = Math.max(16, ...pts.map(p => Math.hypot(p.x - cx, p.y - cy))) + 14;
            return (
              <circle
                key={`cluster-${c.zoneIds.join("-")}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="var(--accent-ink)"
                strokeWidth={1.25}
                strokeDasharray="5 4"
                opacity={0.55}
              />
            );
          })}

        {/* zone markers */}
        {zones.map(z => {
          const { x, y } = projectKenya(z.lat, z.lng);
          const d = dotFor(z.band);
          return (
            <circle
              key={z.id}
              cx={x}
              cy={y}
              r={z.band === "critical" || z.band === "elevated" ? 8 : 6.5}
              fill={d.fill}
              fillOpacity={d.opacity}
              stroke={d.stroke}
              strokeWidth={1.5}
              className="cursor-pointer transition-[r] duration-200"
              onMouseMove={e => setHover({ zone: z, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover({ zone: z, x: 0, y: 0 })}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${z.name}, ${z.county}: risk index ${z.index}, ${BAND_LABELS[z.band]}`}
            >
              <title>{`${z.name} (${z.county}): index ${z.index} / 100, ${BAND_LABELS[z.band]}`}</title>
            </circle>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 max-w-[220px] rounded-md border border-border bg-background px-3 py-2 shadow-sm"
          style={
            hover.x
              ? { left: Math.min(hover.x + 14, typeof window !== "undefined" ? window.innerWidth - 240 : 800), top: hover.y + 14 }
              : { left: "50%", top: "10%", transform: "translateX(-50%)" }
          }
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
            {hover.zone.name}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {hover.zone.county}
          </p>
          <p className="mt-1.5 text-sm tabular-nums text-foreground">
            {hover.zone.index}
            <span className="text-muted-foreground"> / 100</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent-ink)]">
            {BAND_LABELS[hover.zone.band]}
          </p>
        </div>
      )}

      {/* legend */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {(["critical", "elevated", "watch", "baseline"] as RiskBand[]).map(band => {
          const d = dotFor(band);
          return (
            <span key={band} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: d.fill, opacity: d.opacity, border: `1.5px solid ${d.stroke}` }}
              />
              {BAND_LABELS[band]}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-dashed border-[var(--accent-ink)]/70" />
          Significant cluster
        </span>
      </div>
    </div>
  );
}
