"use client";

import { motion } from "framer-motion";

const resolutions = [
  {
    number: "01",
    title: "Zone-level aggregate outputs",
    body: "No individual rankings — the system cannot become a targeting list.",
  },
  {
    number: "02",
    title: "Verified civil society data",
    body: "Not just open sources — Missing Voices, ATI records, encrypted field collection.",
  },
  {
    number: "03",
    title: "Vehicle pattern detection",
    body: "The four-zone rule — a novel application turned against the state, not the citizen.",
  },
  {
    number: "04",
    title: "Bias-corrected statistics",
    body: "Multiple Systems Estimation, empirical Bayes smoothing, SaTScan cluster detection.",
  },
];

export function Verdict() {
  return (
    <section id="verdict" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-6 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="text-[var(--accent-ink)]">05</span>
            <span className="h-px w-10 bg-border" aria-hidden="true" />
            The Bottom Line
          </p>

          <h2 className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            The innovation is not any single component{" "}
            <span className="text-[var(--accent-ink)]">— it is the integration.</span>
          </h2>

          <div className="mt-10 grid gap-10 md:grid-cols-[1.4fr_1fr] md:gap-16">
            <div className="space-y-5 text-base leading-[1.6] text-muted-foreground md:text-[17px]">
              <p>
                The Early Warning Project proves statistical risk modeling works — but at the
                wrong scale. HRDAG proves bias correction works — but retrospectively.
                Bellingcat proves vehicle tracking works — but case-specifically. Forensic
                Architecture proves spatial analysis of state violence works — but
                post-incident.
              </p>
              <p>
                The mission fit does not exist: human rights organizations do documentation,
                not prediction. The technical challenge is harder: sub-national,
                individual-level prediction rather than national aggregates. And the ethical
                tension is unresolved: how to predict without creating a targeting list.
              </p>
            </div>
            <p className="border-l-2 border-[var(--accent-ink)] pl-5 text-lg font-medium leading-snug tracking-tight text-foreground">
              This is genuinely new. And if it works in Kenya, it is globally exportable.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
        >
          {resolutions.map((r) => (
            <div key={r.number} className="bg-background p-6">
              <p className="font-mono text-xs text-[var(--accent-ink)]">{r.number}</p>
              <p className="mt-3 text-base font-medium tracking-[-0.01em] text-foreground">
                {r.title}
              </p>
              <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--accent-ink)]" />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground">
            The Gap Report
          </p>
        </div>
        <p className="max-w-md text-sm leading-[1.6] text-muted-foreground">
          A global landscape assessment of predictive early-warning systems for enforced
          disappearances — compiled from comparative analysis of eight organizations.
        </p>
      </div>
    </footer>
  );
}
