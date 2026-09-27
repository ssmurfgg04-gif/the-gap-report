"use client";

import { motion } from "framer-motion";
import { whyNow, exportRegions, partnerships, regionalNotes } from "@/lib/site-data";
import { Section } from "./section";

const itemAnim = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, delay: Math.min(i * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] } as const,
});

export function Outlook() {
  return (
    <Section
      id="outlook"
      number="06"
      kicker="Outlook"
      title="First mover, by default"
      lede="Nobody globally is building a bias-corrected, vehicle-aware, statistically rigorous early warning system for state abductions of journalists and activists. The conditions for building it now are unusually aligned."
    >
      <div className="grid gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-20">
        <div className="min-w-0">
          <h3 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Why now
          </h3>
          <ol className="border-t border-border">
            {whyNow.map((item, i) => (
              <motion.li
                key={item.title}
                {...itemAnim(i)}
                className="grid grid-cols-[36px_1fr] gap-4 border-b border-border py-5"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-base font-medium text-foreground">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-[1.6] text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>

          <h3 className="mb-6 mt-14 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Export potential, if it works in Kenya
          </h3>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {exportRegions.map((r, i) => (
              <motion.div key={r.country} {...itemAnim(i)} className="bg-background p-5">
                <p className="flex items-center justify-between text-base font-medium text-foreground">
                  {r.country}
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)]" aria-hidden="true" />
                </p>
                <p className="mt-1.5 text-sm leading-[1.6] text-muted-foreground">
                  {r.note}
                </p>
              </motion.div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
            This is not just a Kenya system; it is a prototype for a globally exportable tool.
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Strategic partnerships
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <caption className="sr-only">Strategic partnerships to pursue</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Partner
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Exchange
                  </th>
                </tr>
              </thead>
              <tbody>
                {partnerships.map((p) => (
                  <tr key={p.org} className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
                    <th scope="row" className="px-5 py-4 align-top font-medium text-foreground">
                      {p.org}
                    </th>
                    <td className="px-5 py-4 align-top leading-[1.6]">
                      <span className="block text-foreground/85">{p.theyOffer}</span>
                      <span className="mt-1.5 block text-muted-foreground">
                        for {p.systemOffers.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-6 mt-14 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Regional comparators
          </h3>
          <div className="space-y-8">
            {regionalNotes.map((r, i) => (
              <motion.article key={r.region} {...itemAnim(i)} className="border-t border-border pt-5">
                <p className="text-base font-medium text-foreground">{r.region}</p>
                <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{r.situation}</p>
                <p className="mt-2 text-sm leading-[1.6]">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                    Missing ·{" "}
                  </span>
                  <span className="text-foreground/80">{r.missing}</span>
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
