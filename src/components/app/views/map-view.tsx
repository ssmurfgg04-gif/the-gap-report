"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { KampsAnalysis, ZoneAssessment } from "@/lib/kamps/engine";
import { COUNTIES, COUNTY_BY_KEY, countyRegion } from "@/lib/kenya-counties";
import { BandChip, ConfChip, fmtNum, pValue } from "@/components/site/kamps/ui";
import { CountyRiskMap, mergeZonesByCounty, type CountyZoneSummary } from "../county-map";
import { AnalysisGate } from "../analysis-gate";
import { ViewHeader } from "../view-header";
import type { KampsState } from "../use-kamps";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-sm tabular-nums text-foreground/85">{value}</dd>
    </div>
  );
}

function ZoneDetail({ zone }: { zone: ZoneAssessment }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <BandChip band={zone.band} />
        <ConfChip level={zone.confidence} />
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <span className="text-3xl font-medium tabular-nums tracking-[-0.02em] text-foreground">
          {zone.index.toFixed(1)}
        </span>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-[var(--accent-ink)]"
            style={{ width: `${Math.min(100, zone.index)}%` }}
          />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          / 100
        </span>
      </div>

      <dl className="mt-5">
        <DetailRow label="Documented" value={zone.documented} />
        <DetailRow label="Monitored population" value={fmtNum(zone.population)} />
        <DetailRow
          label="EB rate / 100k"
          value={
            <>
              {zone.ebRate.toFixed(1)}
              <span className="block text-[11px] text-muted-foreground">
                CI {zone.ebCI[0].toFixed(1)} to {zone.ebCI[1].toFixed(1)}
              </span>
            </>
          }
        />
        <DetailRow
          label="MSE estimate"
          value={
            <>
              {fmtNum(zone.mseEstimated)}
              <span className="block text-[11px] text-muted-foreground">
                CI {zone.mseCI[0]} to {zone.mseCI[1]} · x{zone.mseFactor.toFixed(2)}
              </span>
            </>
          }
        />
        <DetailRow
          label="Cluster"
          value={
            zone.clusterRR != null && zone.clusterP != null ? (
              <>
                RR {zone.clusterRR.toFixed(2)}
                <span className="block text-[11px] text-[var(--accent-ink)]">
                  {pValue(zone.clusterP)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground/70">none detected</span>
            )
          }
        />
        <DetailRow
          label="Temporal"
          value={
            <span className={zone.temporalFlagged ? "text-[var(--accent-ink)]" : undefined}>
              {zone.temporalZ >= 0 ? "+" : ""}
              {zone.temporalZ.toFixed(1)} sigma
              <span className="block text-[11px] text-muted-foreground">
                90-day baseline {zone.temporalBaseline.toFixed(1)}
              </span>
            </span>
          }
        />
        <DetailRow label="Vehicle signal" value={zone.vehicleSignal ? "flagged activity" : "none"} />
      </dl>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Drivers
        </p>
        <ul className="mt-2 space-y-1.5">
          {zone.drivers.map((d) => (
            <li key={d} className="flex gap-2.5 text-sm leading-[1.6] text-foreground/80">
              <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent-ink)]/70" aria-hidden="true" />
              <span className="tabular-nums">{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CountyPanel({
  selectedKey,
  summary,
  onClear,
}: {
  selectedKey: string;
  summary: CountyZoneSummary | undefined;
  onClear: () => void;
}) {
  const county = COUNTY_BY_KEY.get(selectedKey);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const ordered = useMemo(
    () => [...(summary?.zones ?? [])].sort((a, b) => b.index - a.index),
    [summary]
  );
  const activeZone = ordered.find((z) => z.id === zoneId) ?? ordered[0];

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-lg border border-border"
      aria-label="County assessment"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {countyRegion(selectedKey)} region
          </p>
          <h2 className="mt-1 text-xl font-medium tracking-[-0.01em] text-foreground">
            {county?.name ?? "County"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear county selection"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] sm:h-9 sm:w-9"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5">
        {summary ? (
          <>
            {ordered.length > 1 && (
              <div className="mb-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {ordered.length} sub-zones · highest shown first
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ordered.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setZoneId(z.id)}
                      aria-pressed={z.id === activeZone?.id}
                      className={`min-h-[44px] rounded-full border px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] sm:min-h-[32px] ${
                        z.id === activeZone?.id
                          ? "border-[var(--accent-ink)] text-[var(--accent-ink)]"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      {z.name} · {z.index.toFixed(0)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeZone && (
              <>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
                  {activeZone.name} · {activeZone.county} county
                </p>
                <ZoneDetail zone={activeZone} />
              </>
            )}
          </>
        ) : (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              No monitoring data
            </p>
            <p className="mt-3 text-sm leading-[1.6] text-muted-foreground">
              No monitoring data for this county yet. The pilot network covers a subset of
              sub-counties; county-level statistics appear here as field collection expands.
              Everything the system publishes stays aggregate: zones and counts, never
              individuals.
            </p>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

function MapBody({
  analysis,
  seedCounty,
}: {
  analysis: KampsAnalysis;
  seedCounty: string | null;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(seedCounty);
  const summaries = useMemo(() => mergeZonesByCounty(analysis.zones), [analysis]);
  const selectedSummary = selectedKey ? summaries.get(selectedKey) : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-10">
      <div className="min-w-0">
        <CountyRiskMap
          zones={analysis.zones}
          selectedKey={selectedKey}
          onSelect={(k) => setSelectedKey((prev) => (prev === k ? null : k))}
        />
      </div>

      <div className="min-w-0 lg:sticky lg:top-[104px] lg:self-start">
        {selectedKey ? (
          <CountyPanel
            key={selectedKey}
            selectedKey={selectedKey}
            summary={selectedSummary}
            onClear={() => setSelectedKey(null)}
          />
        ) : (
          <aside
            className="rounded-lg border border-dashed border-border p-5"
            aria-label="Map instructions"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Zone assessment
            </p>
            <p className="mt-3 text-sm leading-[1.6] text-muted-foreground">
              Select a county to open its zone assessment: documented incidents, bias-corrected
              estimates with intervals, cluster and temporal statistics, and vehicle signals.
              Counties under monitoring are tinted by risk band; the rest render gray.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {[...summaries.entries()].map(([k, s]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedKey(k)}
                  className="min-h-[44px] rounded-full border border-border px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/75 transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] sm:min-h-[32px] dark:text-foreground/85"
                >
                  {s.county}
                  {s.zones.length > 1 ? ` · ${s.zones.length}` : ""}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export function MapView({ kamps, seedCounty }: { kamps: KampsState; seedCounty: string | null }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="Coverage"
        title="County risk map"
        lede="All 47 counties, filled by composite risk band wherever the monitoring network operates. The map reads county-level; the statistics underneath stay sub-county and aggregate."
      />
      <AnalysisGate kamps={kamps}>
        {(analysis) => (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{COUNTIES.length} counties rendered</span>
              <span className="text-[var(--accent-ink)]">{analysis.zones.length} sub-zones monitored</span>
              <span>as of {analysis.asOf.slice(0, 10)}</span>
            </div>
            <MapBody analysis={analysis} seedCounty={seedCounty} />
          </motion.div>
        )}
      </AnalysisGate>
    </div>
  );
}
