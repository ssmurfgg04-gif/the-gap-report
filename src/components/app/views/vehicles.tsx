"use client";

import { motion } from "framer-motion";
import { VehiclePanel } from "@/components/site/kamps/vehicle-panel";
import { AnalysisGate } from "../analysis-gate";
import { ViewHeader } from "../view-header";
import type { KampsState } from "../use-kamps";

export function VehiclesView({ kamps }: { kamps: KampsState }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="Field Signals"
        title="Vehicles"
        lede="Partial plates and composite descriptors from field monitors, assessed by the four-zone sighting rule. Aggregate pattern analysis only: no full plates, no persons."
      />
      <AnalysisGate kamps={kamps}>
        {(analysis) => (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <VehiclePanel analysis={analysis} />
          </motion.div>
        )}
      </AnalysisGate>
    </div>
  );
}
