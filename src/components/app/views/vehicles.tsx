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
        kicker="The cars"
        title="Vehicles"
        lede="The vehicles public reporting has tied to abductions: partial plates, make, color, and the sightings on record, each with its source. The four-zone rule watches for one vehicle resurfacing across abduction and dump sites inside a 30-day window. Descriptors only: no full plates, no owners, no people."
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
