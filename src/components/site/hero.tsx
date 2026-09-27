"use client";

import { motion } from "framer-motion";
import { stats } from "@/lib/site-data";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section id="top" className="relative border-b border-border">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-32 md:pb-24 md:pt-40">
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)]" />
          Global Landscape · A comparative assessment
        </motion.p>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl text-5xl font-medium leading-[1.04] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl"
        >
          Who else is
          <br />
          doing <span className="text-[var(--accent-ink)]">this?</span>
        </motion.h1>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 grid gap-10 md:grid-cols-[1fr_1.5fr] md:gap-16"
        >
          <p className="border-l-2 border-[var(--accent-ink)] pl-5 text-lg font-medium leading-snug tracking-tight text-foreground">
            The pieces exist.
            <br />
            Nobody has assembled&nbsp;them.
          </p>
          <div className="space-y-5 text-base leading-[1.6] text-muted-foreground md:text-[17px]">
            <p>
              Several organizations globally are doing parts of what this system proposes,
              but nobody combines predictive risk modeling, vehicle pattern detection, and
              bias-corrected statistical analysis into a single instrument for tracking state
              abductions of activists and journalists.
            </p>
            <p>
              The closest entities are the Early Warning Project for statistical risk
              forecasting, ACLED&rsquo;s CAST for conflict prediction, HRDAG for
              bias-corrected casualty estimation, and Forensic Architecture for state-violence
              investigation. Each operates at a different scale, methodology, or context;
              none builds this for Kenya.
            </p>
          </div>
        </motion.div>

        <motion.dl
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col bg-background p-7 pb-9 md:p-8 md:pb-10">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="text-5xl font-medium tabular-nums tracking-[-0.04em] text-foreground md:text-6xl">
                {stat.value}
              </dd>
              <dd className="mt-4 font-mono text-[11px] uppercase leading-[1.6] tracking-[0.16em] text-muted-foreground">
                {stat.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
