"use client";

import { motion } from "framer-motion";
import type { KampsAnalysis, KampsAlert } from "@/lib/kamps/engine";
import { cn } from "@/lib/utils";
import { fmtDate } from "./ui";

const SEV_STYLES = {
  critical: "bg-[var(--accent-ink)] text-white",
  elevated: "border border-[var(--accent-ink)] text-[var(--accent-ink)]",
  watch: "border border-dashed border-[var(--accent-ink)]/70 text-[var(--accent-ink)]/90",
  info: "border border-border text-muted-foreground",
} as const;

const SEV_LABEL = {
  critical: "Critical",
  elevated: "Elevated",
  watch: "Watch",
  info: "Informational",
} as const;

function AlertCard({ alert, index }: { alert: KampsAlert; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "bg-background p-6",
        (alert.severity === "critical" || alert.severity === "elevated") &&
          "border-l-2 border-l-[var(--accent-ink)]"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
            SEV_STYLES[alert.severity]
          )}
        >
          {SEV_LABEL[alert.severity]}
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-foreground">{alert.title}</p>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          as of {alert.asOf}
        </span>
      </div>

      <p className="mt-3.5 text-sm leading-[1.6] text-muted-foreground md:text-[15px]">{alert.message}</p>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Drivers</p>
          <ul className="mt-2 space-y-1.5">
            {alert.drivers.map(d => (
              <li key={d} className="flex gap-2.5 text-sm leading-[1.6] text-foreground/80">
                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent-ink)]/70" aria-hidden="true" />
                <span className="tabular-nums">{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Recommended protective actions
          </p>
          <ul className="mt-2 space-y-1.5">
            {alert.actions.map(a => (
              <li key={a} className="flex gap-2.5 text-sm leading-[1.6] text-muted-foreground">
                <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent-ink)]/40" aria-hidden="true" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.article>
  );
}

export function AlertsPanel({ analysis }: { analysis: KampsAnalysis }) {
  const counts = {
    critical: analysis.alerts.filter(a => a.severity === "critical").length,
    elevated: analysis.alerts.filter(a => a.severity === "elevated").length,
    watch: analysis.alerts.filter(a => a.severity === "watch").length,
    info: analysis.alerts.filter(a => a.severity === "info").length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>{analysis.alerts.length} active</span>
          <span className="text-[var(--accent-ink)]">{counts.critical + counts.elevated} action-level</span>
          <span>{counts.watch} watch</span>
          <span>{counts.info} informational</span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Aggregate zone-level output only
        </p>
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border">
        {analysis.alerts.map((a, i) => (
          <AlertCard key={a.id} alert={a} index={i} />
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
          Output contract
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-[1.6] text-muted-foreground">
          Every message names a zone and a statistical finding, never a person. The feed tells partner
          organizations where to tighten protective posture and what posture to adopt: verify check-in
          protocols, pre-position legal counsel, circulate vehicle descriptors through secure channels.
          In production this feed is served read-only through a Tor hidden service, generated on the
          air-gapped analysis machine, and every alert is reviewed by a human before release.
        </p>
      </div>
    </motion.div>
  );
}
