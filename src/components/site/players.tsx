"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { players } from "@/lib/site-data";
import { Section } from "./section";

export function Players() {
  return (
    <Section
      id="field"
      number="01"
      kicker="The Field"
      title="Eight players, eight partial answers"
      lede="The organizations whose work comes closest to a predictive early-warning system for enforced disappearances — and the specific gap each one leaves open."
    >
      <Accordion type="single" collapsible className="border-t border-border">
        {players.map((player, i) => (
          <motion.div
            key={player.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.2) }}
          >
            <AccordionItem
              value={player.name}
              className="group border-b border-border"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 py-2 text-left md:grid-cols-[64px_1fr_220px] md:gap-x-8">
                  <span className="font-mono text-xs text-muted-foreground md:text-sm">
                    {player.index}
                  </span>
                  <span className="player-title text-xl font-medium tracking-[-0.01em] text-foreground transition-colors duration-200 sm:text-2xl">
                    {player.name}
                    {player.closest ? (
                      <span className="ml-3 inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-[var(--accent-ink)] align-middle" />
                    ) : null}
                  </span>
                  <span className="col-span-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:col-span-1 md:text-right">
                    {player.epithet}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-8 pt-1">
                <div className="grid gap-6 md:grid-cols-[64px_1fr] md:gap-x-8">
                  <span className="hidden font-mono text-xs text-muted-foreground md:block" aria-hidden="true">
                    ↳
                  </span>
                  <div className="max-w-2xl space-y-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {player.affiliation}
                    </p>
                    <p className="text-base leading-[1.6] text-foreground/90">
                      {player.what}
                    </p>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Scale
                        </p>
                        <p className="text-sm leading-[1.6] text-foreground/80">
                          {player.scale}
                        </p>
                      </div>
                      <div>
                        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                          The gap
                        </p>
                        <p className="text-sm leading-[1.6] text-foreground/80">
                          {player.gap}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)] align-middle" />
        Closest global comparators
      </p>
    </Section>
  );
}
