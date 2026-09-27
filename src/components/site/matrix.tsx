"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { capabilities, players } from "@/lib/site-data";
import { Section } from "./section";

function Mark({ kind, label }: { kind: string; label: string }) {
  if (kind === "core") {
    return (
      <span className="mark mark-core" role="img" aria-label={label}>
        <span className="mark-fill" aria-hidden="true" />
      </span>
    );
  }
  if (kind === "partial") {
    return (
      <span className="mark mark-partial" role="img" aria-label={label}>
        <span className="mark-half" aria-hidden="true" />
      </span>
    );
  }
  return <span className="mark mark-none" role="img" aria-label={label} aria-hidden="false" />;
}

export function Matrix() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      el.classList.toggle("matrix-scrolled", el.scrollLeft > 4);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Section
      id="matrix"
      number="02"
      kicker="The Matrix"
      title="The definitive gap analysis"
      lede="Eight capability dimensions against the eight organizations, plus the system this report assesses. Where every comparator fails, one column does not."
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="mark mark-core"><span className="mark-fill" /></span>
            Core capability
          </span>
          <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="mark mark-partial"><span className="mark-half" /></span>
            Partial
          </span>
          <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="mark mark-none" />
            Not present
          </span>
        </div>

        <div className="relative">
          <p className="pointer-events-none absolute -top-9 right-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:hidden">
            Swipe to compare →
          </p>
          <div
            ref={scrollRef}
            className="matrix-scroll overflow-x-auto overscroll-x-contain rounded-lg border border-border"
            role="region"
            aria-label="Capability comparison table, horizontally scrollable"
            tabIndex={0}
          >
          <table className="w-full min-w-[880px] border-collapse text-left">
            <caption className="sr-only">
              Capability comparison across eight organizations and the proposed system
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-background px-5 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Capability
                </th>
                {players.map((p) => (
                  <th
                    key={p.name}
                    scope="col"
                    className="px-3 py-4 align-bottom font-mono text-[10px] font-medium uppercase leading-[1.5] tracking-[0.06em] text-muted-foreground"
                  >
                    <span className="block max-w-[88px]">{p.name}</span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="this-col-header border-b-2 border-[var(--accent-ink)] px-4 py-4 align-bottom font-mono text-[10px] font-medium uppercase leading-[1.5] tracking-[0.06em] text-[var(--accent-ink)]"
                >
                  <span className="block max-w-[96px]">This System</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((row) => (
                <tr
                  key={row.capability}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background px-5 py-4 text-sm font-medium text-foreground"
                  >
                    {row.capability}
                  </th>
                  {row.values.map((v, idx) => (
                    <td key={idx} className="px-4 py-4 text-center">
                      <Mark
                        kind={v}
                        label={`${players[idx].name}: ${v === "core" ? "yes" : v === "partial" ? "partial" : "no"}`}
                      />
                    </td>
                  ))}
                  <td className="this-col px-4 py-4 text-center">
                    <Mark
                      kind={row.thisSystem}
                      label={`This system: ${row.thisSystem === "core" ? "core feature" : "partial"}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-[1.6] text-muted-foreground">
          No row is satisfied by any single comparator. Vehicle pattern recognition, spatial
          scan statistics, and bias-corrected prediction of individual abductions are absent
          from the entire field: the three dimensions where integration, not invention,
          becomes the innovation.
        </p>
      </motion.div>
    </Section>
  );
}
