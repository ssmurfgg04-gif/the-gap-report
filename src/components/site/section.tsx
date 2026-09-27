"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Section({
  id,
  number,
  kicker,
  title,
  lede,
  children,
  bordered = true,
}: {
  id: string;
  number: string;
  kicker: string;
  title: string;
  lede?: string;
  children: ReactNode;
  bordered?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${bordered ? "border-b border-border" : ""} scroll-mt-16`}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 md:mb-16"
        >
          <p className="mb-6 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="text-[var(--accent-ink)]">{number}</span>
            <span className="h-px w-10 bg-border" aria-hidden="true" />
            {kicker}
          </p>
          <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl md:text-5xl">
            {title}
          </h2>
          {lede ? (
            <p className="mt-5 max-w-2xl text-base leading-[1.6] text-muted-foreground md:text-lg">
              {lede}
            </p>
          ) : null}
        </motion.div>

        {children}
      </div>
    </section>
  );
}
