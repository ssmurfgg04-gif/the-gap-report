/** Real-data engine test: run the pipeline and print a summary. */
import { getKampsAnalysis } from "../src/lib/kamps/engine";

async function main() {
  const a = await getKampsAnalysis();
  const o = a.overview;

  // regression: the Nairobi "outside Parliament" incident must be counted
  const { loadPublicRecordIncidents } = await import("../src/lib/kamps/real-data");
  const pr = loadPublicRecordIncidents();
  const parliament = pr.find(i => i.location?.includes("outside Parliament"));
  if (!parliament || parliament.county !== "Nairobi") {
    throw new Error("REGRESSION: 'Nairobi (outside Parliament)' incident lost");
  }
  // 227 through the 2026-09-26 data refresh; +2: Githurai (June 2026) and
  // Kiprotich (Sept 2026). If this regresses, an ER pair or the window broke.
  if (o.documentedTotal !== 229) {
    throw new Error(`REGRESSION: documentedTotal expected 229, got ${o.documentedTotal}`);
  }
  console.log(`asOf ${a.asOf.slice(0, 10)} | window ${a.dataWindow.start} to ${a.dataWindow.end} | ${o.zones} counties`);
  console.log(`documented ${o.documentedTotal} (located ${o.documentedLocated}, unlocated ${o.unlocatedIncidents})`);
  console.log(`MSE: method=${a.mse.method} nA=${a.mse.nA} nB=${a.mse.nB} overlap=${a.mse.overlap} -> estimated ${o.estimatedTotal} (CI ${o.estimateCI}) factor x${o.underreportingFactor}`);
  console.log(`capture: MV ${o.captureRates.mv}% news ${o.captureRates.ob}%`);
  console.log(`clusters (sig): ${o.significantClusters}  vehicles: flagged ${o.flaggedVehicles} / documented ${o.documentedVehicles}  alerts: ${a.alerts.length} (${o.activeAlerts} action-level)`);
  console.log(`highest zone: ${o.highestZone} ${o.highestIndex}`);

  console.log("\nTop 12 zones:");
  for (const z of [...a.zones].sort((x, y) => y.index - x.index).slice(0, 12)) {
    console.log(
      `  ${z.name.padEnd(16)} ${String(z.index).padStart(5)} ${z.band.padEnd(9)} doc ${String(z.documented).padStart(3)} ` +
      `EB ${z.ebRate.toFixed(2).padStart(7)} RR ${z.clusterRR ?? "-"} z ${z.temporalZ >= 0 ? "+" : ""}${z.temporalZ.toFixed(1)} ` +
      `ucdp ${String(z.ucdpEvents).padStart(3)} veh ${z.vehicleSignal ? "Y" : "-"} conf ${z.confidence}`
    );
  }

  console.log("\nClusters:");
  for (const c of a.clusters) {
    console.log(`  [${c.zoneNames.join(", ")}] RR ${c.rr.toFixed(2)} p ${c.p} obs ${c.observed} exp ${c.expected} r ${c.radiusKm}km`);
  }

  console.log("\nVehicles:");
  for (const v of a.vehicles) {
    console.log(`  ${v.vehicleKey} ${v.status.padEnd(10)} ${v.color} ${v.make} ${v.model} (${v.platePartial}) n=${v.clusterSightings} inc=${v.incidentOverlap} conf ${v.confidence}`);
  }

  console.log("\nTemporal (recent months):");
  for (const r of a.temporal.recent) {
    console.log(`  ${r.month}: ${r.ed} cases vs baseline ${r.baseline} (z ${r.z}${r.flagged ? " FLAGGED" : ""})`);
  }

  console.log("\nForecast:");
  const f = a.forecast;
  console.log(`  backtest: AUC ${f.backtest.auc} Brier ${f.backtest.brier} hit ${(f.backtest.hitRate * 100).toFixed(0)}% cov95 ${(f.backtest.coverage95 * 100).toFixed(1)}% n=${f.backtest.nPredictions}`);
  console.log(`  national 3m: ${f.national.forecastMonths.map((m, i) => `${m}: ${f.national.mean[i]} [${f.national.lower95[i]}, ${f.national.upper95[i]}]`).join(" | ")}`);
  console.log(`  projections top5: ${f.projections.slice(0, 5).map(p => `${p.county} ${p.currentIndex} -> ${p.projectedIndex} (trend ${p.trend})`).join(" | ")}`);

  console.log("\nAlerts:");
  for (const al of a.alerts) {
    console.log(`  [${al.severity}] ${al.title}`);
  }

  console.log("\nProvenance:");
  for (const pf of a.provenance.files) {
    console.log(`  ${pf.file} (${pf.rows}) ${pf.quality}`);
  }
  console.log(`  gaps: ${a.provenance.gaps.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
