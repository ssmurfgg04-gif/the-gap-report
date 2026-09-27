"use client";

import { motion } from "framer-motion";
import { whyNot, learnings } from "@/lib/site-data";
import { Section } from "./section";

const itemAnim = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.55, delay: Math.min(i * 0.06, 0.24), ease: [0.22, 1, 0.36, 1] } as const,
});

export function Analysis() {
  return (
    <Section
      id="analysis"
      number="03"
      kicker="Analysis"
      title="Why nobody has built this"
      lede="Five structural reasons the global field of human rights monitoring never produced a predictive, vehicle-aware, bias-corrected early warning system for enforced disappearances."
    >
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
        {whyNot.map((item, i) => (
          <motion.article
            key={item.index}
            {...itemAnim(i)}
            className={`bg-background p-7 md:p-8 ${
              i === 0 ? "md:col-span-2 lg:col-span-1" : ""
            }`}
          >
            <p className="font-mono text-sm text-[var(--accent-ink)]">{item.index}</p>
            <h3 className="mt-4 text-lg font-medium tracking-[-0.01em] text-foreground">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-[1.6] text-muted-foreground">
              {item.body}
            </p>
          </motion.article>
        ))}
        <motion.article
          {...itemAnim(5)}
          className="result-cell flex flex-col justify-between bg-background p-7 md:col-span-2 md:p-8 lg:col-span-1"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent-ink)]">
            The result
          </p>
          <p className="mt-6 max-w-xl text-xl font-medium leading-snug tracking-[-0.01em] text-foreground md:text-2xl">
            The pieces exist at eight different organizations. The assembly does not exist
            anywhere.
          </p>
        </motion.article>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-20"
      >
        <div className="mb-8 flex items-baseline justify-between gap-6">
          <h3 className="text-2xl font-medium tracking-[-0.02em] text-foreground md:text-3xl">
            What to learn from each
          </h3>
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
            Adopt / Avoid
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
          {learnings.map((l) => (
            <article key={l.org} className="bg-background p-6 md:p-7">
              <h4 className="text-base font-medium text-foreground">{l.org}</h4>
              <dl className="mt-4 space-y-3 text-sm leading-[1.6]">
                <div className="grid grid-cols-[72px_1fr] gap-3">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                    Adopt
                  </dt>
                  <dd className="text-foreground/85">{l.adopt}</dd>
                </div>
                <div className="grid grid-cols-[72px_1fr] gap-3">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Avoid
                  </dt>
                  <dd className="text-muted-foreground">{l.avoid}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}
