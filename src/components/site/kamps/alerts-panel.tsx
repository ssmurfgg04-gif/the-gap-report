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
  const nw = analysis.newsWatch;
  const gdeltOk = analysis.media?.gdelt?.status === "ok";
  const gdeltLatest = analysis.media?.gdelt?.monthly?.at(-1);

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

      {nw && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 rounded-lg border border-border border-l-2 border-l-[var(--accent-ink)]/70 p-6"
          aria-labelledby="news-watch-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="news-watch-heading" className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
              News watch
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              pulled {fmtDate(nw.generatedAt)} · {nw.feeds.length} feeds · discovery, not verified cases
            </p>
          </div>

          <p className="mt-3 max-w-3xl text-sm leading-[1.6] text-muted-foreground">
            Every week the pipeline sweeps Google News, Bing News and the KNCHR statement index for
            abduction, disappearance and missing-person coverage. What lands here is raw discovery:
            {nw.last7d} matching articles in the last 7 days against a baseline of {nw.weeklyBaseline} per week.
            A human still verifies each one before it can count as a documented incident. That is the
            honesty rule and it does not bend.
          </p>

          <div className="mt-5 grid gap-6 md:grid-cols-[1fr_240px]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Latest matching coverage
              </p>
              <ul className="mt-3 divide-y divide-border">
                {nw.articles.slice(0, 8).map((a) => (
                  <li key={a.url} className="py-2.5">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-baseline gap-3"
                    >
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {a.pubDate.slice(5)}
                      </span>
                      <span className="text-sm leading-[1.5] text-foreground/90 group-hover:text-[var(--accent-ink)]">
                        {a.title}
                      </span>
                      <span className="ml-auto hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:block">
                        {a.source}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Last 30 days</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                  {nw.last30d}
                </p>
                <p className="text-xs leading-[1.5] text-muted-foreground">matching articles</p>
              </div>
              {nw.counties.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Most-mentioned counties
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {nw.counties.slice(0, 5).map(c => (
                      <li key={c.county} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-foreground/80">{c.county}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">KNCHR index</p>
                <p className="mt-1 text-sm leading-[1.5] text-foreground/80">
                  latest statement id {nw.knchr.latestId ?? "-"}
                  {nw.knchr.newSinceLastRun
                    ? `, ${nw.knchr.newSinceLastRun} new since last sweep`
                    : ", no new statements since last sweep"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">GDELT volume</p>
                <p className="mt-1 text-sm leading-[1.5] text-foreground/80">
                  {gdeltOk && gdeltLatest
                    ? `${gdeltLatest.volume} articles in ${gdeltLatest.month} (media attention, not incidence)`
                    : "unavailable this run"}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {analysis.context && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 rounded-lg border border-border p-6"
          aria-labelledby="context-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="context-heading" className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
              Election clock
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {analysis.context.monthsToElection} months to {fmtDate(analysis.context.nextElection)}
            </p>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-[1.6] text-muted-foreground">
            {analysis.context.note}
          </p>
        </motion.section>
      )}

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
