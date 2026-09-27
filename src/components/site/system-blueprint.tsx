"use client";

import { motion } from "framer-motion";
import {
  kampsIdentity,
  architecture,
  dataTiers,
  pipeline,
  safeguardPairs,
  ethicsStatement,
  roadmapPhases,
} from "@/lib/kamps-content";
import { Section } from "./section";

const itemAnim = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, delay: Math.min(i * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] } as const,
});

const blockAnim = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } as const,
};

function SubHead({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground ${className}`}>
      {children}
    </h3>
  );
}

export function SystemBlueprint() {
  return (
    <Section
      id="system"
      number="04"
      kicker={kampsIdentity.kicker}
      title={kampsIdentity.title}
      lede={kampsIdentity.lede}
    >
      {/* ————— Architecture: four layers ————— */}
      <motion.div {...blockAnim}>
        <SubHead>Architecture · four layers, air-gapped at the core</SubHead>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {architecture.map((layer, i) => (
            <motion.article key={layer.index} {...itemAnim(i)} className="bg-background p-6 md:p-7">
              <p className="font-mono text-xs text-[var(--accent-ink)]">{layer.index}</p>
              <h4 className="mt-3 text-lg font-medium tracking-[-0.01em] text-foreground">{layer.name}</h4>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {layer.role}
              </p>
              <ul className="mt-4 space-y-2.5">
                {layer.points.map(point => (
                  <li key={point} className="flex gap-2.5 text-sm leading-[1.6] text-muted-foreground">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent-ink)]/70" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
          The master database never touches the internet. Data moves by encrypted transfer between
          layers, and only the aggregate alert layer is ever published.
        </p>
      </motion.div>

      {/* ————— Data tiers ————— */}
      <motion.div {...blockAnim} className="mt-16 md:mt-20">
        <SubHead>Data sources · three-tier reliability hierarchy</SubHead>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
          {dataTiers.map((tier, i) => (
            <motion.article key={tier.tier} {...itemAnim(i)} className="bg-background p-6 md:p-7">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--accent-ink)]">{tier.tier}</p>
                <p className="text-sm font-medium text-foreground">{tier.label}</p>
              </div>
              <ul className="mt-5 space-y-2 border-t border-border pt-5">
                {tier.sources.map(src => (
                  <li key={src} className="text-sm leading-[1.6] text-foreground/85">
                    {src}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">{tier.use}</p>
            </motion.article>
          ))}
        </div>
      </motion.div>

      {/* ————— Six-stage pipeline ————— */}
      <motion.div {...blockAnim} className="mt-16 md:mt-20">
        <SubHead>The analytical engine · six stages</SubHead>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Six-stage analytical pipeline</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-16 px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Stage</th>
                <th scope="col" className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Method</th>
                <th scope="col" className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Detail</th>
                <th scope="col" className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Output</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map(stage => (
                <tr key={stage.stage} className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
                  <td className="px-5 py-4 align-top">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)]" aria-hidden="true" />
                      <span className="font-mono text-xs text-[var(--accent-ink)]">{stage.stage}</span>
                    </span>
                  </td>
                  <th scope="row" className="px-5 py-4 align-top font-medium text-foreground">{stage.name}</th>
                  <td className="px-5 py-4 align-top leading-[1.6] text-muted-foreground">{stage.method}</td>
                  <td className="px-5 py-4 align-top leading-[1.6] text-foreground/85">{stage.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
          Stages 2 through 5 correct for the two biases that ruin naive crime maps: small-population noise
          and underreporting. Stage 6 turns the corrected evidence into a single comparable score.
        </p>
      </motion.div>

      {/* ————— Safeguards ————— */}
      <motion.div {...blockAnim} className="mt-16 md:mt-20">
        <SubHead>Safeguards · what could go wrong, and the countermeasure</SubHead>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {safeguardPairs.map((pair, i) => (
            <motion.article key={pair.risk} {...itemAnim(i)} className="bg-background p-6">
              <p className="text-sm font-medium text-foreground">{pair.risk}</p>
              <p className="mt-2.5 text-sm leading-[1.6] text-muted-foreground">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                  Mitigation ·{" "}
                </span>
                {pair.mitigation}
              </p>
            </motion.article>
          ))}
        </div>

        <motion.div
          {...blockAnim}
          className="mt-6 rounded-lg border border-border border-l-2 border-l-[var(--accent-ink)] bg-background p-7 md:p-9"
        >
          <p className="max-w-2xl text-xl font-medium leading-snug tracking-[-0.01em] text-foreground md:text-2xl">
            {ethicsStatement.headline}
          </p>
          <p className="mt-4 max-w-3xl text-base leading-[1.6] text-muted-foreground md:text-[17px]">
            {ethicsStatement.body}
          </p>
        </motion.div>
      </motion.div>

      {/* ————— Roadmap ————— */}
      <motion.div {...blockAnim} className="mt-16 md:mt-20">
        <SubHead>Implementation roadmap · six months to public launch</SubHead>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {roadmapPhases.map((phase, i) => (
            <motion.article key={phase.phase} {...itemAnim(i)} className="bg-background p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--accent-ink)]">{phase.phase}</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{phase.window}</p>
              </div>
              <p className="mt-3 text-base font-medium text-foreground">{phase.title}</p>
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {phase.items.map(item => (
                  <li key={item} className="flex gap-2.5 text-sm leading-[1.6] text-muted-foreground">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent-ink)]/70" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
          Phase 4 runs the system in shadow mode first: outputs are generated and scored against real
          outcomes before anything is published. The live panel below is that shadow mode, already
          running on real ingested data.
        </p>
      </motion.div>
    </Section>
  );
}
