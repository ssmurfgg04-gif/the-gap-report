"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import { livePanel } from "@/lib/kamps-content";
import { Section } from "./section";
import { RiskPanel } from "./kamps/risk-panel";
import { BiasPanel } from "./kamps/bias-panel";
import { VehiclePanel } from "./kamps/vehicle-panel";
import { AlertsPanel } from "./kamps/alerts-panel";
import { fmtNum } from "./kamps/ui";

function KpiCell({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col bg-background p-6 pb-8 md:p-7 md:pb-9">
      <p className={`text-4xl font-medium tabular-nums tracking-[-0.03em] md:text-5xl ${accent ? "text-[var(--accent-ink)]" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-3 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function SystemLive() {
  const [analysis, setAnalysis] = useState<KampsAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kamps")
      .then(r => {
        if (!r.ok) throw new Error(`engine responded ${r.status}`);
        return r.json() as Promise<KampsAnalysis>;
      })
      .then(data => { if (!cancelled) setAnalysis(data); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "engine failure"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Section
      id="model"
      number="05"
      kicker={livePanel.kicker}
      title={livePanel.title}
      lede={livePanel.lede}
    >
      {/* status strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 flex flex-wrap items-center gap-3"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--accent-ink)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)] dark:border-solid">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)]" aria-hidden="true" />
          Real ingested data
        </span>
        {analysis && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            as of {analysis.asOf.slice(0, 10)} · computed live by the engine
          </span>
        )}
      </motion.div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6" role="alert">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">Engine error</p>
          <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">
            The analysis engine failed to load: {error}. Reload the page to retry.
          </p>
        </div>
      )}

      {!error && !analysis && (
        <div className="space-y-8" aria-label="Loading engine output">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-background p-6 pb-8 md:p-7 md:pb-9">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="mt-4 h-3 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-10 lg:grid-cols-[400px_1fr]">
            <Skeleton className="h-[420px] w-full rounded-lg" />
            <Skeleton className="h-[420px] w-full rounded-lg" />
          </div>
        </div>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* KPI strip */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            <KpiCell value={fmtNum(analysis.overview.documentedTotal)} label="Documented incidents in the warehouse" />
            <KpiCell value={fmtNum(analysis.overview.estimatedTotal)} label={`MSE-estimated true total (x${analysis.overview.underreportingFactor.toFixed(2)})`} accent />
            <KpiCell value={String(analysis.overview.significantClusters)} label="Significant spatial clusters, pop-adjusted" />
            <KpiCell value={String(analysis.overview.flaggedVehicles)} label="Vehicles flagged by the four-zone rule" />
          </dl>

          <p className="mt-4 max-w-3xl text-sm leading-[1.6] text-muted-foreground">{livePanel.dataNote}</p>

          {/* tabs */}
          <Tabs defaultValue="risk" className="mt-10">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-full border border-border bg-background p-1 sm:w-auto">
              <TabsTrigger
                value="risk"
                className="rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                Risk index
              </TabsTrigger>
              <TabsTrigger
                value="bias"
                className="rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                Bias correction
              </TabsTrigger>
              <TabsTrigger
                value="vehicles"
                className="rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                Vehicles
              </TabsTrigger>
              <TabsTrigger
                value="alerts"
                className="rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                Alerts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="risk" className="mt-8">
              <RiskPanel analysis={analysis} />
            </TabsContent>
            <TabsContent value="bias" className="mt-8">
              <BiasPanel analysis={analysis} />
            </TabsContent>
            <TabsContent value="vehicles" className="mt-8">
              <VehiclePanel analysis={analysis} />
            </TabsContent>
            <TabsContent value="alerts" className="mt-8">
              <AlertsPanel analysis={analysis} />
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </Section>
  );
}
