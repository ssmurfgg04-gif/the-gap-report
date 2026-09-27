/** Sanity check for the KAMPS engine: run the pipeline and print results. */
import { getKampsAnalysis } from "../src/lib/kamps/engine";
import { writeFileSync } from "fs";

async function main() {
  const a = await getKampsAnalysis();
  console.log(`asOf: ${a.asOf.slice(0, 10)}  zones: ${a.overview.zones}`);
  console.log(`documented ${a.overview.documentedTotal} | MSE estimate ${a.overview.estimatedTotal} (CI ${a.estimate0 ?? a.overview.estimateCI})`);
  console.log(`ground truth (simulator): ${a.groundTruth}`);
  console.log(`underreporting factor: ${a.overview.underreportingFactor}x`);
  console.log(`capture rates: MV ${a.overview.captureRates.mv}% OB ${a.overview.captureRates.ob}% MORT ${a.overview.captureRates.mort}%`);
  console.log(`significant clusters: ${a.overview.significantClusters}  flagged vehicles: ${a.overview.flaggedVehicles}  active alerts: ${a.overview.activeAlerts}`);
  console.log(`highest zone: ${a.overview.highestZone} ${a.overview.highestIndex}`);

  console.log("\nMSE overlap pattern (all zones):");
  console.log(`  only MV ${a.mse.onlyMV} | only OB ${a.mse.onlyOB} | only MORT ${a.mse.onlyMort}`);
  console.log(`  MV+OB ${a.mse.mvOb} | MV+MORT ${a.mse.mvMort} | OB+MORT ${a.mse.obMort} | all three ${a.mse.allThree}`);
  console.log(`  pairs: MV/OB ${a.mse.pairMV_OB} MV/MORT ${a.mse.pairMV_Mort} OB/MORT ${a.mse.pairOB_Mort}`);

  console.log("\nZones (by index):");
  const sorted = [...a.zones].sort((x, y) => y.index - x.index);
  for (const z of sorted) {
    console.log(
      `  ${z.name.padEnd(18)} ${String(z.index).padStart(5)} ${z.band.padEnd(9)} ` +
      `doc ${String(z.documented).padStart(3)} EB ${z.ebRate.toFixed(1).padStart(6)} ` +
      `MSE ${String(z.mseEstimated).padStart(3)} (x${z.mseFactor.toFixed(2)}) ` +
      `RR ${z.clusterRR ?? "-"} z ${z.temporalZ >= 0 ? "+" : ""}${z.temporalZ.toFixed(1)} veh ${z.vehicleSignal ? "Y" : "-"} conf ${z.confidence}`
    );
  }

  console.log("\nClusters:");
  for (const c of a.clusters) {
    console.log(`  [${c.zoneNames.join(", ")}] RR ${c.rr.toFixed(2)} p ${c.p} obs ${c.observed} exp ${c.expected.toFixed(1)} r ${c.radiusKm}km`);
  }

  console.log("\nVehicles:");
  for (const v of a.vehicles) {
    console.log(`  ${v.vehicleKey} ${v.status.padEnd(10)} ${v.color} ${v.make} ${v.model} (${v.platePartial}) n=${v.clusterSightings} inc=${v.incidentOverlap} conf ${v.confidence}`);
  }

  console.log("\nAlerts:");
  for (const al of a.alerts) {
    console.log(`  [${al.severity}] ${al.title}`);
  }

  writeFileSync("/tmp/kamps-analysis.json", JSON.stringify(a, null, 1));
  console.log("\nwrote /tmp/kamps-analysis.json");
}

main().catch(e => { console.error(e); process.exit(1); });
