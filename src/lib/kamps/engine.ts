/**
 * KAMPS engine: loads the (simulated) warehouse, runs the six-stage pipeline,
 * assesses vehicles, and composes the aggregate alert feed. Results are cached
 * in module scope because the demonstration dataset is static.
 */
import { db } from "@/lib/db";
import {
  empiricalBayes, runMSE, spatialScan, temporalAnomaly,
  compositeRisk, riskBand, percentileRanks, RISK_WEIGHTS,
} from "./stats";
import { assessVehicles, VEHICLE_RULE, type VehicleAssessment, type Sighting } from "./vehicle";
import {
  zoneRiskAlerts, clusterAlert, vehicleAlert, dataAlert,
  type KampsAlert,
} from "./alerts";

export type ZoneAssessment = {
  id: number;
  name: string;
  county: string;
  lat: number;
  lng: number;
  population: number;
  documented: number;
  crudeRate: number;
  ebRate: number;
  ebCI: [number, number];
  mseEstimated: number;
  mseCI: [number, number];
  mseFactor: number;
  mseConfidence: "high" | "medium" | "low";
  mseDetail: {
    onlyMV: number; onlyOB: number; onlyMort: number;
    mvOb: number; mvMort: number; obMort: number; allThree: number;
    pairMV_OB: number | null; pairMV_Mort: number | null; pairOB_Mort: number | null;
  };
  clusterRR: number | null;
  clusterP: number | null;
  temporalZ: number;
  temporalCurrent: number;
  temporalBaseline: number;
  temporalFlagged: boolean;
  vehicleSignal: boolean;
  components: {
    ebPercentile: number;
    msePercentile: number;
    clusterScore: number;
    temporalScore: number;
    vehicleScore: number;
  };
  index: number;
  band: "critical" | "elevated" | "watch" | "baseline";
  confidence: "high" | "medium" | "low";
  drivers: string[];
};

// JSON-serialized shapes crossing the API boundary (dates as ISO strings)
export type SightingJSON = Omit<Sighting, "date"> & { date: string };
export type VehicleAssessmentJSON = Omit<
  VehicleAssessment,
  "windowStart" | "windowEnd" | "lastSeen" | "sightings"
> & {
  windowStart: string;
  windowEnd: string;
  lastSeen: string;
  sightings: SightingJSON[];
};

export type KampsAnalysis = {
  asOf: string;
  simulated: true;
  groundTruth: number | null;
  overview: {
    zones: number;
    documentedTotal: number;
    estimatedTotal: number;
    pooledEstimate: number;
    estimateCI: [number, number];
    underreportingFactor: number;
    captureRates: { mv: number; ob: number; mort: number };
    significantClusters: number;
    flaggedVehicles: number;
    activeAlerts: number;
    highestZone: string;
    highestIndex: number;
  };
  mse: ReturnType<typeof runMSE>;
  clusters: Array<{
    zoneNames: string[];
    rr: number;
    p: number;
    observed: number;
    expected: number;
    radiusKm: number;
    zoneIds: number[];
  }>;
  zones: ZoneAssessment[];
  vehicles: VehicleAssessmentJSON[];
  alerts: KampsAlert[];
  weights: typeof RISK_WEIGHTS;
  vehicleRule: typeof VEHICLE_RULE;
};

let cache: Promise<KampsAnalysis> | null = null;

export function getKampsAnalysis(): Promise<KampsAnalysis> {
  if (cache) return cache;
  cache = compute().catch(e => { cache = null; throw e; });
  return cache;
}

async function compute(): Promise<KampsAnalysis> {
  const [zoneRows, incidentRows, sightingRows, metaRows] = await Promise.all([
    db.kampsZone.findMany({ orderBy: { id: "asc" } }),
    db.kampsIncident.findMany(),
    db.kampsSighting.findMany(),
    db.kampsMeta.findMany(),
  ]);

  const meta = new Map(metaRows.map(m => [m.key, m.value]));
  const asOf = new Date(meta.get("as_of") ?? "2026-09-20T00:00:00Z");
  const groundTruth = meta.has("simulated_true_total") ? Number(meta.get("simulated_true_total")) : null;

  const captures = incidentRows.map(i => ({
    mv: i.inMissingVoices, ob: i.inPoliceOB, mort: i.inMortuary,
  }));
  const mse = runMSE(captures);

  // ————— per-zone pipeline —————
  const counts = zoneRows.map(z => incidentRows.filter(i => i.zoneId === z.id).length);
  const populations = zoneRows.map(z => z.population);
  const eb = empiricalBayes(counts, populations);

  const zoneMSE = zoneRows.map((z, zi) => {
    const caps = incidentRows
      .filter(i => i.zoneId === z.id)
      .map(i => ({ mv: i.inMissingVoices, ob: i.inPoliceOB, mort: i.inMortuary }));
    return runMSE(caps);
  });

  const temporal = zoneRows.map(z =>
    temporalAnomaly(
      incidentRows.filter(i => i.zoneId === z.id).map(i => i.date),
      asOf
    )
  );

  // spatial scan on MSE-adjusted case counts (bias-corrected input)
  const adjustedCases = zoneRows.map((z, zi) => counts[zi] * zoneMSE[zi].factor);
  const scanInput = zoneRows.map((z, zi) => ({
    id: z.id, lat: z.lat, lng: z.lng, population: z.population, cases: Math.round(adjustedCases[zi]),
  }));
  const clusters = spatialScan(scanInput);
  const zoneCluster = new Map<number, { rr: number; p: number }>();
  for (const c of clusters) {
    if (c.p > 0.05) continue;
    for (const id of c.zoneIds) {
      const prev = zoneCluster.get(id);
      if (!prev || c.rr > prev.rr) zoneCluster.set(id, { rr: c.rr, p: c.p });
    }
  }

  // ————— vehicle signals —————
  const sightings = sightingRows.map(s => ({
    id: s.id, date: s.date, zoneId: s.zoneId,
    zoneName: zoneRows.find(z => z.id === s.zoneId)?.name ?? "",
    vehicleKey: s.vehicleKey, platePartial: s.platePartial,
    make: s.make, model: s.model, color: s.color, source: s.source,
  }));
  const incidentsLite = incidentRows.map(i => ({ date: i.date, zoneId: i.zoneId }));
  const vehicles = assessVehicles(sightings, incidentsLite, zoneRows.map(z => ({ id: z.id, name: z.name, lat: z.lat, lng: z.lng })));

  // zones with flagged-vehicle sightings within the assessment window (180 days)
  // feed the vehicle component of the composite index
  const flaggedZoneIds = new Set<number>();
  const DAY = 86400000;
  for (const v of vehicles) {
    if (v.status !== "flagged") continue;
    for (const s of v.sightings) {
      if (asOf.getTime() - s.date.getTime() <= 180 * DAY) flaggedZoneIds.add(s.zoneId);
    }
  }

  // ————— composite index —————
  const ebPct = percentileRanks(eb.map(e => e.ratePer100k));
  // bias-corrected rate: MSE-adjusted cases per capita (not raw totals)
  const msePct = percentileRanks(zoneMSE.map((m, zi) => m.estimated / zoneRows[zi].population));
  const zoneRisk: ZoneAssessment[] = zoneRows.map((z, zi) => {
    const cluster = zoneCluster.get(z.id);
    const t = temporal[zi];
    const m = zoneMSE[zi];
    const components = {
      ebPercentile: ebPct[zi],
      msePercentile: msePct[zi],
      clusterScore: cluster ? Math.min(1, Math.max(0, (cluster.rr - 1) / 3)) : 0,
      temporalScore: Math.min(1, Math.max(0, (t.z - 1) / 2.5)),
      vehicleScore: flaggedZoneIds.has(z.id) ? 1 : 0,
    };
    const index = compositeRisk(components);
    const band = riskBand(index);
    const confidence = counts[zi] >= 40 ? "high" : counts[zi] >= 15 ? "medium" : "low";

    const drivers: string[] = [];
    if (cluster) drivers.push(`Spatial cluster: RR ${cluster.rr.toFixed(2)} (p = ${cluster.p < 0.001 ? "< 0.001" : cluster.p.toFixed(3)})`);
    if (t.flagged) drivers.push(`Temporal anomaly: +${t.z.toFixed(1)} sigma over 90-day baseline`);
    if (m.factor >= 1.4) drivers.push(`Underreporting: MSE factor ${m.factor.toFixed(2)}x`);
    if (flaggedZoneIds.has(z.id)) drivers.push("Flagged vehicle pattern activity");
    if (drivers.length === 0) drivers.push(`EB-smoothed rate ${eb[zi].ratePer100k.toFixed(1)} per 100k`);

    return {
      id: z.id, name: z.name, county: z.county, lat: z.lat, lng: z.lng,
      population: z.population,
      documented: counts[zi],
      crudeRate: Math.round((counts[zi] / z.population) * 1e5 * 100) / 100,
      ebRate: Math.round(eb[zi].ratePer100k * 10) / 10,
      ebCI: [Math.round(eb[zi].ciLow * 10) / 10, Math.round(eb[zi].ciHigh * 10) / 10],
      mseEstimated: m.estimated,
      mseCI: [m.ciLow, m.ciHigh],
      mseFactor: Math.round(m.factor * 100) / 100,
      mseConfidence: m.confidence,
      mseDetail: {
        onlyMV: m.onlyMV, onlyOB: m.onlyOB, onlyMort: m.onlyMort,
        mvOb: m.mvOb, mvMort: m.mvMort, obMort: m.obMort, allThree: m.allThree,
        pairMV_OB: m.pairMV_OB, pairMV_Mort: m.pairMV_Mort, pairOB_Mort: m.pairOB_Mort,
      },
      clusterRR: cluster ? Math.round(cluster.rr * 100) / 100 : null,
      clusterP: cluster ? cluster.p : null,
      temporalZ: t.z,
      temporalCurrent: t.current,
      temporalBaseline: t.baselineMean,
      temporalFlagged: t.flagged,
      vehicleSignal: flaggedZoneIds.has(z.id),
      components: {
        ebPercentile: Math.round(components.ebPercentile * 1000) / 1000,
        msePercentile: Math.round(components.msePercentile * 1000) / 1000,
        clusterScore: Math.round(components.clusterScore * 1000) / 1000,
        temporalScore: Math.round(components.temporalScore * 1000) / 1000,
        vehicleScore: components.vehicleScore,
      },
      index,
      band,
      confidence,
      drivers,
    };
  });

  // ————— alerts —————
  const clusterZoneNames = clusters
    .filter(c => c.p <= 0.05)
    .map(c => ({
      zoneNames: c.zoneIds.map(id => zoneRows.find(z => z.id === id)!.name),
      rr: c.rr, p: c.p, observed: c.observed, expected: c.expected, radiusKm: c.radiusKm,
    }));

  const alerts: KampsAlert[] = [
    ...zoneRiskAlerts(zoneRisk, asOf),
    ...clusterZoneNames.map(cc => clusterAlert(cc, asOf)),
    ...vehicles.filter(v => v.status === "flagged").map(v => vehicleAlert(v, asOf)),
    dataAlert(mse.documented, mse.estimated, asOf),
  ];
  const sevOrder = { critical: 0, elevated: 1, watch: 2, info: 3 } as const;
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  const significant = clusters.filter(c => c.p <= 0.05);
  const top = [...zoneRisk].sort((a, b) => b.index - a.index)[0];

  // stratified estimate: sum of zone-level MSE estimates (capture probabilities
  // vary by zone, so stratification beats the pooled estimator); the pooled
  // national estimator is kept for reference
  const stratifiedTotal = zoneRisk.reduce((s, z) => s + z.mseEstimated, 0);

  // serialize dates for the API boundary
  const vehiclesOut: VehicleAssessmentJSON[] = vehicles.map(v => ({
    ...v,
    windowStart: v.windowStart.toISOString(),
    windowEnd: v.windowEnd.toISOString(),
    lastSeen: v.lastSeen.toISOString(),
    sightings: v.sightings.map(s => ({ ...s, date: s.date.toISOString() })),
  }));

  return {
    asOf: asOf.toISOString(),
    simulated: true,
    groundTruth,
    overview: {
      zones: zoneRows.length,
      documentedTotal: mse.documented,
      estimatedTotal: stratifiedTotal,
      pooledEstimate: mse.estimated,
      estimateCI: [mse.ciLow, mse.ciHigh],
      underreportingFactor: Math.round((stratifiedTotal / Math.max(mse.documented, 1)) * 100) / 100,
      captureRates: {
        mv: Math.round(mse.pMV * 1000) / 10,
        ob: Math.round(mse.pOB * 1000) / 10,
        mort: Math.round(mse.pMort * 1000) / 10,
      },
      significantClusters: significant.length,
      flaggedVehicles: vehicles.filter(v => v.status === "flagged").length,
      activeAlerts: alerts.filter(a => a.severity !== "info").length,
      highestZone: top?.name ?? "-",
      highestIndex: top?.index ?? 0,
    },
    mse,
    clusters: clusters.map(c => ({
      zoneNames: c.zoneIds.map(id => zoneRows.find(z => z.id === id)!.name),
      rr: c.rr, p: c.p, observed: c.observed, expected: c.expected, radiusKm: c.radiusKm, zoneIds: c.zoneIds,
    })),
    zones: zoneRisk,
    vehicles: vehiclesOut,
    alerts,
    weights: RISK_WEIGHTS,
    vehicleRule: VEHICLE_RULE,
  };
}
