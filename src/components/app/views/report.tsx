"use client";

import { Hero } from "@/components/site/hero";
import { Players } from "@/components/site/players";
import { Matrix } from "@/components/site/matrix";
import { Analysis } from "@/components/site/analysis";
import { SystemBlueprint } from "@/components/site/system-blueprint";
import { SystemLive } from "@/components/site/system-live";
import { Outlook } from "@/components/site/outlook";
import { Verdict, Footer } from "@/components/site/verdict";

/**
 * The full original report, unchanged, inside the app shell. The live engine
 * section and all anchor ids survive, so nothing from the long-form document
 * is lost by the application surface.
 */
export function ReportView() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Players />
      <Matrix />
      <Analysis />
      <SystemBlueprint />
      <SystemLive />
      <Outlook />
      <Verdict />
      <Footer />
    </div>
  );
}
