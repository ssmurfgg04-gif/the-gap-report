"use client";

import { motion } from "framer-motion";
import { AlertsPanel } from "@/components/site/kamps/alerts-panel";
import { AnalysisGate } from "../analysis-gate";
import { ViewHeader } from "../view-header";
import type { KampsState } from "../use-kamps";

export function AlertsView({ kamps }: { kamps: KampsState }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="What just happened"
        title="Alerts"
        lede="The feed the rest of the app is here to produce: zone-level findings, protective actions worth taking, and the moments the data itself shifted. Every message names a zone and a statistic, never a person."
      />
      <AnalysisGate kamps={kamps}>
        {(analysis) => (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <AlertsPanel analysis={analysis} />
          </motion.div>
        )}
      </AnalysisGate>
    </div>
  );
}
