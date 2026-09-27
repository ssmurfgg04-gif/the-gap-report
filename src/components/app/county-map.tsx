"use client";

import { useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  COUNTIES,
  COUNTIES_VIEWBOX,
  COUNTY_BY_KEY,
  countyKey,
  countyRegion,
} from "@/lib/kenya-counties";
import type { ZoneAssessment } from "@/lib/kamps/engine";
import type { RiskBand } from "@/lib/kamps/stats";
import { BAND_LABELS, fmtNum } from "@/components/site/kamps/ui";

export type CountyZoneSummary = {
  /** county join key */
  key: string;
  /** canonical county name */
  county: string;
  /** every monitored sub-zone inside the county */
  zones: ZoneAssessment[];
  /** max-index sub-zone */
  top: ZoneAssessment;
  maxIndex: number;
  band: RiskBand;
  documented: number;
  population: number;
};

/**
 * Merge API zones into the 47 counties by name (case- and punctuation-
 * insensitive). Multiple sub-zones in one county collapse to the max index;
 * the side panel keeps every sub-zone addressable.
 */
export function mergeZonesByCounty(zones: ZoneAssessment[]): Map<string, CountyZoneSummary> {
  const map = new Map<string, CountyZoneSummary>();
  for (const z of zones) {
    const key = countyKey(z.county);
    const county = COUNTY_BY_KEY.get(key)?.name ?? z.county;
    const existing = map.get(key);
    if (existing) {
      existing.zones.push(z);
      existing.documented += z.documented;
      existing.population += z.population;
      if (z.index > existing.maxIndex) {
        existing.maxIndex = z.index;
        existing.top = z;
        existing.band = z.band;
      }
    } else {
      map.set(key, {
        key,
        county,
        zones: [z],
        top: z,
        maxIndex: z.index,
        band: z.band,
        documented: z.documented,
        population: z.population,
      });
    }
  }
  return map;
}

const W = 420;
const H = 460;
const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type FillSpec = { fill: string; opacity: number; stroke: string; strokeOpacity: number; strokeWidth: number };

function fillFor(band: RiskBand | "none", hovered: boolean, selected: boolean): FillSpec {
  const bump = hovered ? 0.1 : 0;
  if (selected) {
    return {
      fill: band === "none" ? "var(--muted-foreground)" : "var(--accent-ink)",
      opacity: (band === "none" ? 0.25 : band === "critical" ? 0.6 : band === "elevated" ? 0.4 : 0.25) + (hovered ? bump : 0),
      stroke: "var(--accent-ink)",
      strokeOpacity: 1,
      strokeWidth: 2,
    };
  }
  switch (band) {
    case "critical":
      return { fill: "var(--accent-ink)", opacity: 0.55 + bump, stroke: "var(--accent-ink)", strokeOpacity: 0.9, strokeWidth: 2 };
    case "elevated":
      return { fill: "var(--accent-ink)", opacity: 0.3 + bump, stroke: "var(--muted-foreground)", strokeOpacity: 0.5, strokeWidth: 0.75 };
    case "watch":
      return { fill: "var(--accent-ink)", opacity: 0.12 + bump, stroke: "var(--muted-foreground)", strokeOpacity: 0.5, strokeWidth: 0.75 };
    case "baseline":
      return { fill: "var(--muted-foreground)", opacity: 0.14 + bump, stroke: "var(--muted-foreground)", strokeOpacity: 0.5, strokeWidth: 0.75 };
    default:
      return { fill: "var(--muted-foreground)", opacity: 0.07 + bump, stroke: "var(--muted-foreground)", strokeOpacity: 0.35, strokeWidth: 0.6 };
  }
}

type TooltipState = { key: string; x: number; y: number } | null;

/**
 * Interactive map of all 47 Kenya counties. Counties fill by risk band when
 * zone data exists and render as quiet gray otherwise. Hover brightens and
 * shows a tooltip; click or Enter selects the county. Pan by dragging, zoom
 * with the controls (hidden when `compact`).
 */
export function CountyRiskMap({
  zones,
  selectedKey,
  onSelect,
  compact = false,
}: {
  zones: ZoneAssessment[];
  selectedKey: string | null;
  onSelect?: (key: string | null) => void;
  compact?: boolean;
}) {
  const summary = useMemo(() => mergeZonesByCounty(zones), [zones]);
  const [hover, setHover] = useState<TooltipState>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);
  const movedRef = useRef(false);

  const clampPan = (x: number, y: number, z: number) => ({
    x: clamp(x, W * (1 - z), 0),
    y: clamp(y, H * (1 - z), 0),
  });

  const zoomBy = (factor: number) => {
    const z1 = clamp(zoom * factor, 1, MAX_ZOOM);
    // keep the viewport center anchored
    const x = W / 2 - ((W / 2 - pan.x) / zoom) * z1;
    const y = H / 2 - ((H / 2 - pan.y) / zoom) * z1;
    setZoom(z1);
    setPan(clampPan(x, y, z1));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (compact) return;
    movedRef.current = false;
    dragRef.current = { px: e.clientX, py: e.clientY, tx: pan.x, ty: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) > 4) movedRef.current = true;
    const k = W / rect.width;
    setPan(clampPan(d.tx + (e.clientX - d.px) * k, d.ty + (e.clientY - d.py) * k, zoom));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const choose = (key: string) => {
    if (movedRef.current) return; // it was a pan, not a click
    onSelect?.(key);
  };

  const hoveredCounty = hover ? COUNTIES.find((c) => c.key === hover.key) : null;
  const hoveredSummary = hover ? summary.get(hover.key) : undefined;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={COUNTIES_VIEWBOX}
        role="group"
        aria-label={`Interactive map of Kenya's 47 counties, filled by composite risk band where monitoring data exists${compact ? "" : ", drag to pan, use the zoom controls to enlarge"}`}
        className={`block h-auto w-full ${compact ? "" : "cursor-grab active:cursor-grabbing"}`}
        style={compact ? undefined : { touchAction: zoom > 1 ? "none" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {COUNTIES.map((c) => {
            const s = summary.get(c.key);
            const band: RiskBand | "none" = s ? s.band : "none";
            const isHover = hover?.key === c.key;
            const isSel = selectedKey === c.key;
            const f = fillFor(band, isHover, isSel);
            return (
              <path
                key={c.key}
                d={c.path}
                fill={f.fill}
                fillOpacity={f.opacity}
                stroke={f.stroke}
                strokeOpacity={f.strokeOpacity}
                strokeWidth={f.strokeWidth}
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="button"
                aria-pressed={isSel}
                aria-label={`${c.name} county: ${s ? `${BAND_LABELS[s.band]} band, index ${s.maxIndex.toFixed(1)}, ${s.zones.length} monitored sub-zone${s.zones.length > 1 ? "s" : ""}` : "no monitoring data"}`}
                className="cursor-pointer transition-[fill-opacity,stroke-opacity] duration-150 focus-visible:outline-2 focus-visible:outline-[var(--accent-ink)]"
                onMouseMove={(e) => setHover({ key: c.key, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover((h) => (h?.key === c.key ? null : h))}
                onClick={() => choose(c.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(c.key);
                  }
                }}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({ key: c.key, x: r.left + r.width / 2, y: r.top });
                }}
                onBlur={() => setHover((h) => (h?.key === c.key ? null : h))}
              />
            );
          })}
        </g>
      </svg>

      {/* tooltip (mouse + keyboard focus) */}
      {hover && hoveredCounty && (
        <div
          className="pointer-events-none fixed z-50 w-[230px] rounded-md border border-border bg-background px-3 py-2.5 shadow-sm"
          style={{
            left: Math.min(hover.x + 14, typeof window !== "undefined" ? window.innerWidth - 250 : 800),
            top: hover.y + 14,
          }}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
            {hoveredCounty.name}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {countyRegion(hoveredCounty.key)} region
          </p>
          {hoveredSummary ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm tabular-nums text-foreground">
                {hoveredSummary.maxIndex.toFixed(1)}
                <span className="text-muted-foreground"> / 100</span>
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent-ink)]">
                  {BAND_LABELS[hoveredSummary.band]}
                </span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {hoveredSummary.zones.length > 1
                  ? `${hoveredSummary.zones.length} sub-zones · `
                  : ""}
                {fmtNum(hoveredSummary.documented)} documented
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                monitored pop. {fmtNum(hoveredSummary.population)}
              </p>
            </div>
          ) : (
            <p className="mt-2 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.12em] text-muted-foreground">
              No monitoring data for this county yet
            </p>
          )}
        </div>
      )}

      {/* pan/zoom controls */}
      {!compact && (
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => zoomBy(1.5)}
            aria-label="Zoom in"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background/95 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] sm:h-9 sm:w-9"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            aria-label="Zoom out"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background/95 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] sm:h-9 sm:w-9"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset map view"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background/95 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] sm:h-9 sm:w-9"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {([
          { band: "critical" as const, label: "Critical" },
          { band: "elevated" as const, label: "Elevated" },
          { band: "watch" as const, label: "Watch" },
          { band: "baseline" as const, label: "Baseline" },
          { band: "none" as const, label: "No data" },
        ]).map(({ band, label }) => {
          const f = fillFor(band, false, false);
          return (
            <span
              key={label}
              className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{
                  background: f.fill,
                  opacity: f.opacity + 0.15,
                  border: `1px solid ${f.stroke}`,
                }}
              />
              {label}
            </span>
          );
        })}
      </div>
      {!compact && (
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Zoom in to pan · click a county for the zone assessment · counties without monitoring render gray
        </p>
      )}
    </div>
  );
}
