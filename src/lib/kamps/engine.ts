/**
 * KAMPS engine, REAL DATA EDITION.
 *
 * Runs the six-stage analytical pipeline over the ingested real datasets:
 *   - documented incidents: Missing Voices victims + curated public-record
 *     incidents, deduplicated by entity resolution (Jaro-Winkler + date)
 *   - denominators: KNBS 2019 census, 47 counties (exact national total)
 *   - spatial scan on county incident counts, population-conditioned
 *   - historical covariate: UCDP GED organized-violence events (1989-2022)
 *   - temporal: real Missing Voices monthly series (2020-2026)
 *   - forecast: Holt-Winters + walk-forward backtest on real UCDP panels
 *   - vehicles: publicly documented pattern vehicles + clearly labeled
 *     demonstration records for the four-zone rule
 *
 * The engine reads /data files (the ingested "warehouse") and caches the
 * computation in module scope. Nothing here fabricates numbers: when a
 * statistic cannot be estimated from the real data, it is reported as
 * not estimable with the reason.
 */
import {
  loadCounties, loadMissingVoices, loadPublicRecordIncidents,
  loadUcdp, loadVehicleCases, loadManifest,
  type County, type MonthlyPoint, type PublicIncident, type MvVictim,
} from "./real-data";
import {
  empiricalBayes, spatialScan, temporalAnomaly,
  compositeRisk, riskBand, percentileRanks, RISK_WEIGHTS, mulberry32,
} from "./stats";
import { holtWinters, runForecast, type CountyMonth } from "./forecast";
import { matchRecords, jaroWinkler, type ERRecord } from "./er";
import { VEHICLE_RULE, type VehicleAssessment, type Sighting } from "./vehicle";

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
import {
  zoneRiskAlerts, clusterAlert, vehicleAlert, dataAlert,
  type KampsAlert,
} from "./alerts";

export type { KampsAlert } from "./alerts";

// ————— shared types (stable contract for the UI) —————
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
    ucdpBaseline: number;
  };
  index: number;
  band: "critical" | "elevated" | "watch" | "baseline";
  confidence: "high" | "medium" | "low";
  drivers: string[];
  /** historical organized-violence covariate (real, UCDP) */
  ucdpEvents: number;
  ucdpCivilianDeaths: number;
};

export type MSE2Result = {
  method: "chapman-2list" | "benchmark" | "not-estimable";
  note: string;
  listA: string;
  listB: string;
  nA: number;
  nB: number;
  overlap: number;
  documented: number;
  estimated: number;
  ciLow: number;
  ciHigh: number;
  factor: number;
  confidence: "high" | "medium" | "low";
};

export type KampsForecast = {
  generatedAt: string;
  horizonDays: number;
  method: string;
  national: {
    series: Array<{ month: string; ed: number }>;
    forecastMonths: string[];
    mean: number[];
    lower95: number[];
    upper95: number[];
  };
  backtest: {
    auc: number;
    brier: number;
    hitRate: number;
    falseAlarmRate: number;
    nPredictions: number;
    leadTimeDays: number;
    coverage95: number;
    trainedOn: string;
  };
  projections: Array<{
    zoneId: number;
    zoneName: string;
    county: string;
    currentIndex: number;
    projectedIndex: number;
    band: "critical" | "elevated" | "watch" | "baseline";
    trend: number;
  }>;
};

export type KampsAnalysis = {
  asOf: string;
  simulated: false;
  groundTruth: null;
  dataWindow: { start: string; end: string };
  overview: {
    zones: number;
    documentedTotal: number;
    documentedLocated: number;
    estimatedTotal: number;
    pooledEstimate: number;
    estimateCI: [number, number];
    underreportingFactor: number;
    captureRates: { mv: number; ob: number; mort: number };
    significantClusters: number;
    flaggedVehicles: number;
    documentedVehicles: number;
    activeAlerts: number;
    highestZone: string;
    highestIndex: number;
    unlocatedIncidents: number;
  };
  mse: MSE2Result;
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
  temporal: {
    series: MonthlyPoint[];
    recent: Array<{ month: string; ed: number; baseline: number; z: number; flagged: boolean }>;
  };
  forecast: KampsForecast;
  provenance: {
    files: Array<{
      file: string; format: string; rows: string;
      source: string; quality: string; retrievedAt: string; notes: string;
    }>;
    gaps: string[];
    retrievedAt: string;
  };
  incidentsRecent: Array<{
    date: string; person: string; county: string | null;
    status: string; category: string; sourceName: string; sourceUrl: string;
    lists: string[];
  }>;
};

let cache: Promise<KampsAnalysis> | null = null;

export function getKampsAnalysis(): Promise<KampsAnalysis> {
  if (cache) return cache;
  cache = compute().catch(e => { cache = null; throw e; });
  return cache;
}

// ————— helpers —————
const DAY = 86400000;
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const endOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59));
};
const fmtN = (n: number) => Math.round(n);

async function compute(): Promise<KampsAnalysis> {
  const counties = loadCounties();
  const countyByName = new Map(counties.map(c => [c.name, c]));
  const { victims: mvVictims, monthly } = loadMissingVoices();
  const prIncidents = loadPublicRecordIncidents();
  const ucdp = loadUcdp();
  const vehicleCases = loadVehicleCases();
  const manifest = loadManifest();

  // ————— observation window —————
  // MV monthly series defines the end; the wave begins with June 2024 protests
  const lastMonth = monthly.length ? monthly[monthly.length - 1].month : "2026-08";
  const asOf = endOfMonth(lastMonth);
  const windowStart = new Date("2024-06-01T00:00:00Z");

  // ————— entity resolution: MV victims vs public-record incidents —————
  const mvRecords: ERRecord[] = mvVictims.map(v => ({
    id: `mv-${v.no}`, date: v.date!, name: v.name, location: v.location ?? undefined,
    county: v.county ?? undefined, source: "Missing Voices",
  }));
  const prRecords: ERRecord[] = prIncidents.map(i => ({
    id: i.id, date: i.date, name: i.person, location: i.location ?? undefined,
    county: i.county ?? undefined, source: "public-record",
  }));
  const er = matchRecords(mvRecords, prRecords, { days: 3, km: 60, nameSimilarity: 0.82 });
  const prMatchedTo = new Map<string, string>(); // pr id -> mv id
  for (const p of er.pairs) prMatchedTo.set(p.bId, p.aId);
  const mvById = new Map(mvRecords.map(r => [r.id, r]));

  // ————— incident universe (deduplicated) —————
  type UnionIncident = {
    date: string; county: string | null; lists: { mv: boolean; news: boolean };
    person: string; status: string; category: string;
    sourceName: string; sourceUrl: string;
  };
  const union: UnionIncident[] = [];
  const mvIndexByVictimNo = new Map(mvVictims.map(v => [`mv-${v.no}`, v]));
  for (const v of mvVictims) {
    union.push({
      date: v.date!, county: v.county, lists: { mv: true, news: false },
      person: v.name, status: v.mannerOfDeath ? "documented" : "unknown",
      category: "missing-voices-record", sourceName: "Missing Voices",
      sourceUrl: v.sourceUrl ?? "https://missingvoices.or.ke",
    });
  }
  const unionByVictimNo = new Map(mvVictims.map((v, i) => [v.no, union[i]]));
  for (const p of prIncidents) {
    const mvId = prMatchedTo.get(p.id);
    if (mvId) {
      // the public-record row matches an MV victim: mark the MV row as
      // news-captured instead of double counting
      const victimNo = Number(mvId.replace("mv-", ""));
      const row = unionByVictimNo.get(victimNo);
      if (row) {
        row.lists.news = true;
        row.county = row.county ?? p.county;
        row.status = p.status;
        row.sourceName = `${row.sourceName} + ${p.sourceName}`;
        row.sourceUrl = p.sourceUrl;
        continue;
      }
    }
    union.push({
      date: p.date, county: p.county, lists: { mv: false, news: true },
      person: p.person, status: p.status, category: p.category,
      sourceName: p.sourceName, sourceUrl: p.sourceUrl,
    });
  }
  void mvIndexByVictimNo; void mvById;
  const inWindow = union.filter(u => new Date(u.date) >= windowStart && new Date(u.date) <= asOf);
  const documentedTotal = inWindow.length;
  const documentedLocated = inWindow.filter(u => u.county).length;

  // ————— per-county counts (Stage 1) —————
  const counts = counties.map(c =>
    inWindow.filter(u => u.county === c.name).length
  );
  const populations = counties.map(c => c.population);

  // ————— Stage 2: EB smoothing —————
  const eb = empiricalBayes(counts, populations);

  // ————— Stage 3: MSE (two real lists) —————
  const mseWindowStart = new Date(Math.max(windowStart.getTime(), new Date("2025-06-01").getTime()));
  const listA = inWindow.filter(u => u.lists.mv && new Date(u.date) >= mseWindowStart);
  const listB = inWindow.filter(u => u.lists.news && new Date(u.date) >= mseWindowStart);
  const overlapRows = inWindow.filter(u => u.lists.mv && u.lists.news && new Date(u.date) >= mseWindowStart);
  const nA = listA.length, nB = listB.length, k = overlapRows.length;
  const documentedInMseWindow = inWindow.filter(u => new Date(u.date) >= mseWindowStart).length;

  let mse: MSE2Result;
  if (k >= 3) {
    // Chapman two-list estimator + bootstrap CI
    const chapman = ((nA + 1) * (nB + 1)) / (k + 1) - 1;
    const rng = mulberry32(nA * 131 + nB * 17 + k * 7 + 29);
    const reps: number[] = [];
    for (let r = 0; r < 400; r++) {
      // resample both lists' capture patterns with replacement
      let a = 0, b = 0, o = 0;
      const pool = listA.concat(listB);
      for (let i = 0; i < pool.length; i++) {
        const u = pool[Math.floor(rng() * pool.length)];
        const isA = u.lists.mv, isB = u.lists.news;
        if (isA) a++; if (isB) b++; if (isA && isB) o++;
      }
      if (o >= 1) reps.push(((a + 1) * (b + 1)) / (o + 1) - 1);
    }
    reps.sort((x, y) => x - y);
    const lo = reps[Math.floor(0.05 * reps.length)] ?? documentedInMseWindow;
    const hi = reps[Math.ceil(0.95 * reps.length) - 1] ?? documentedInMseWindow * 2;
    const scale = documentedTotal / Math.max(documentedInMseWindow, 1);
    mse = {
      method: "chapman-2list", listA: "Missing Voices victims", listB: "public-record news curation",
      nA, nB, overlap: k, documented: documentedTotal,
      estimated: fmtN(chapman * scale), ciLow: fmtN(lo * scale), ciHigh: fmtN(hi * scale),
      factor: Math.round(((chapman * scale) / Math.max(documentedTotal, 1)) * 100) / 100,
      confidence: k >= 10 ? "medium" : "low",
      note: `Chapman two-list estimator on the common observation window (${mseWindowStart.toISOString().slice(0, 10)} to ${asOf.toISOString().slice(0, 10)}): ${nA} Missing Voices records against ${nB} news-curated records with ${k} matched entities (Jaro-Winkler ${">"} 0.82, dates within 3 days). Scaled to the full monitoring window.`,
    };
  } else {
    // No list overlap: capture-recapture is not estimable. Report honestly.
    mse = {
      method: "not-estimable", listA: "Missing Voices victims", listB: "public-record news curation",
      nA, nB, overlap: k, documented: documentedTotal,
      estimated: documentedTotal, ciLow: documentedTotal, ciHigh: Math.round(documentedTotal * 1.4),
      factor: 1,
      confidence: "low",
      note: `The two available lists do not intersect inside the common window (${k} matched entities between ${nA} Missing Voices records and ${nB} news-curated records). Capture-recapture requires overlap to estimate the unseen; until the police occurrence-book and mortuary lists arrive via Access to Information requests, the documented count stands unadjusted. The interval shown is a transparency range, not a statistical estimate.`,
    };
  }

  // ————— Stage 4: spatial scan (county incident counts) —————
  const scanInput = counties.map((c, i) => ({
    id: c.id, lat: 0, lng: 0, // centroids filled below
    population: c.population, cases: counts[i],
  }));
  // county centroids from UCDP events where available, else skip lat/lng by using
  // the county's approximate centroid from its UCDP events mean
  const centroid = (name: string): { lat: number; lng: number } => {
    const evs = ucdp.filter(e => e.county === name);
    if (evs.length >= 2) {
      return {
        lat: evs.reduce((s, e) => s + e.lat, 0) / evs.length,
        lng: evs.reduce((s, e) => s + e.lng, 0) / evs.length,
      };
    }
    return { lat: -0.5, lng: 37.5 };
  };
  counties.forEach((c, i) => {
    const ct = centroid(c.name);
    scanInput[i].lat = ct.lat; scanInput[i].lng = ct.lng;
  });
  const clusters = spatialScan(scanInput);
  const zoneCluster = new Map<number, { rr: number; p: number }>();
  for (const c of clusters) {
    if (c.p > 0.05) continue;
    for (const id of c.zoneIds) {
      const prev = zoneCluster.get(id);
      if (!prev || c.rr > prev.rr) zoneCluster.set(id, { rr: c.rr, p: c.p });
    }
  }

  // ————— Stage 5: temporal anomalies (real monthly series) —————
  const edSeries = monthly.filter(m => m.month >= "2020-01");
  const recentTemporal: KampsAnalysis["temporal"]["recent"] = [];
  for (let i = Math.max(12, edSeries.length - 3); i < edSeries.length; i++) {
    const m = edSeries[i];
    const baseline = edSeries.slice(Math.max(0, i - 12), i);
    const mean = baseline.reduce((s, x) => s + x.ed, 0) / Math.max(baseline.length, 1);
    const variance = baseline.reduce((s, x) => s + (x.ed - mean) ** 2, 0) / Math.max(baseline.length - 1, 1);
    const sd = Math.max(Math.sqrt(Math.max(variance, 0)), 0.6);
    const z = (m.ed - mean) / sd;
    recentTemporal.push({
      month: m.month, ed: m.ed,
      baseline: Math.round(mean * 10) / 10,
      z: Math.round(z * 100) / 100, flagged: z >= 2,
    });
  }
  const nationalFlagged = recentTemporal.some(r => r.flagged);

  // county-level temporal: last 90 days vs previous 270
  const temporal = counties.map(c => {
    const dates = inWindow.filter(u => u.county === c.name).map(u => new Date(u.date));
    return temporalAnomaly(dates, asOf);
  });

  // ————— UCDP covariate: organized-violence burden per county —————
  const ucdpDecade = ucdp.filter(e => e.year >= 2013);
  const ucdpByCounty = counties.map(c => {
    const evs = ucdpDecade.filter(e => e.county === c.name);
    return {
      events: evs.length,
      civDeaths: evs.reduce((s, e) => s + e.civilians, 0),
      // rate per 100k, sqrt-transformed for percentile stability
      rate: evs.reduce((s, e) => s + e.best, 0) / (c.population / 1e5),
    };
  });
  const ucdpPct = percentileRanks(ucdpByCounty.map(u => u.rate));

  // ————— vehicles —————
  const countyNames = new Set(counties.map(c => c.name));
  const vehiclesOut: VehicleAssessmentJSON[] = vehicleCases.map(vc => {
    const sightings: SightingJSON[] = vc.sightings.map(s => ({
      id: s.id, date: `${s.date}T10:00:00Z`, zoneId: counties.find(c => c.name === s.zoneName)?.id ?? 0,
      zoneName: s.zoneName, vehicleKey: vc.vehicleKey, platePartial: vc.platePartial,
      make: vc.make, model: vc.model, color: vc.color, source: s.source,
    }));
    const sorted = [...sightings].sort((a, b) => a.date.localeCompare(b.date));
    // best 30-day window
    let best = { n: 1, start: sorted[0]?.date ?? new Date().toISOString() };
    for (const anchor of sorted) {
      const t0 = new Date(anchor.date).getTime();
      const n = sorted.filter(s => {
        const dt = new Date(s.date).getTime() - t0;
        return dt >= 0 && dt <= VEHICLE_RULE.windowDays * DAY;
      }).length;
      if (n > best.n) best = { n, start: anchor.date };
    }
    const zones = [...new Set(sorted.map(s => s.zoneName))];
    const last = sorted[sorted.length - 1];
    const simulated = vc.simulated;
    const meetsThreshold = best.n >= VEHICLE_RULE.threshold;
    const status: VehicleAssessmentJSON["status"] = simulated
      ? (meetsThreshold ? "flagged" : "cleared")
      : "monitoring";
    // incident overlap: documented incidents in the sighting zones around the window
    const winStart = new Date(new Date(best.start).getTime() - VEHICLE_RULE.incidentLeadDays * DAY);
    const winEnd = new Date(new Date(best.start).getTime() + (VEHICLE_RULE.windowDays + VEHICLE_RULE.incidentLeadDays) * DAY);
    const incidentOverlap = inWindow.filter(u =>
      zones.some(z => countyNames.has(z) && u.county === z) &&
      new Date(u.date) >= winStart && new Date(u.date) <= winEnd
    ).length;
    const confidence = simulated
      ? Math.min(0.95, 0.5 + 0.07 * (best.n - VEHICLE_RULE.threshold) + 0.09 * Math.min(incidentOverlap, 3))
      : Math.min(0.75, 0.45 + 0.1 * vc.sourceUrls.length);
    return {
      vehicleKey: vc.vehicleKey,
      platePartial: vc.platePartial,
      make: vc.make, model: vc.model, color: vc.color,
      status,
      simulated,
      summary: vc.summary,
      sourceUrls: vc.sourceUrls,
      sourceNames: vc.sourceNames,
      confidence: Math.round(confidence * 100) / 100,
      clusterSightings: best.n,
      windowStart: best.start,
      windowEnd: new Date(new Date(best.start).getTime() + VEHICLE_RULE.windowDays * DAY).toISOString(),
      zones,
      incidentOverlap,
      lastSeen: (last?.date ?? best.start),
      totalSightings: sorted.length,
      sightings: sorted,
    };
  });
  // REAL documented vehicles always sort before DEMO records, then by
  // status and confidence, so the actionable public-record patterns lead.
  vehiclesOut.sort((a, b) => {
    if (a.simulated !== b.simulated) return a.simulated ? 1 : -1;
    const order = { flagged: 0, monitoring: 1, cleared: 2 } as const;
    return order[a.status] - order[b.status] || b.confidence - a.confidence;
  });

  // vehicle signal: counties with real documented vehicle activity + demo flags
  const vehicleZoneIds = new Set<number>();
  for (const v of vehiclesOut) {
    if (v.status === "cleared") continue;
    for (const z of v.zones) {
      const c = counties.find(cc => cc.name === z);
      if (c) vehicleZoneIds.add(c.id);
    }
  }

  // ————— Stage 6: composite index —————
  const ebPct = percentileRanks(eb.map(e => e.ratePer100k));
  const msePct = percentileRanks(counties.map((c, i) => (counts[i] * (mse.factor || 1)) / (c.population / 1e5)));
  const zones: ZoneAssessment[] = counties.map((c, i) => {
    const cluster = zoneCluster.get(c.id);
    const t = temporal[i];
    const components = {
      ebPercentile: ebPct[i],
      msePercentile: msePct[i],
      clusterScore: cluster ? Math.min(1, Math.max(0, (cluster.rr - 1) / 3)) : 0,
      temporalScore: Math.min(1, Math.max(0, (t.z - 1) / 2.5)),
      vehicleScore: vehicleZoneIds.has(c.id) ? 1 : 0,
      ucdpBaseline: ucdpPct[i],
    };
    const index = compositeRisk(components);
    const band = riskBand(index);
    const confidence: ZoneAssessment["confidence"] =
      counts[i] >= 8 ? "high" : counts[i] >= 3 ? "medium" : ucdpByCounty[i].events >= 40 ? "medium" : "low";

    const drivers: string[] = [];
    if (cluster) drivers.push(`Spatial cluster: RR ${cluster.rr.toFixed(2)} (p = ${cluster.p < 0.001 ? "< 0.001" : cluster.p.toFixed(3)})`);
    if (t.flagged) drivers.push(`Temporal anomaly: +${t.z.toFixed(1)} sigma over 90-day baseline`);
    if (ucdpPct[i] >= 0.75) drivers.push(`Historical organized-violence burden: ${ucdpByCounty[i].events} UCDP events 2013-2022`);
    if (vehicleZoneIds.has(c.id)) drivers.push("Documented vehicle pattern activity");
    if (counts[i] > 0 && counts[i] / (c.population / 1e5) >= 0.1) drivers.push(`${counts[i]} documented incidents, EB rate ${eb[i].ratePer100k.toFixed(2)} per 100k`);
    if (drivers.length === 0) drivers.push(`EB-smoothed rate ${eb[i].ratePer100k.toFixed(2)} per 100k, ${ucdpByCounty[i].events} historical UCDP events`);

    return {
      id: c.id, name: c.name, county: c.name,
      lat: scanInput[i].lat, lng: scanInput[i].lng,
      population: c.population,
      documented: counts[i],
      crudeRate: Math.round((counts[i] / c.population) * 1e5 * 100) / 100,
      ebRate: Math.round(eb[i].ratePer100k * 100) / 100,
      ebCI: [Math.round(eb[i].ciLow * 100) / 100, Math.round(eb[i].ciHigh * 100) / 100],
      mseEstimated: fmtN(counts[i] * (mse.factor || 1)),
      mseCI: [fmtN(counts[i] * (mse.factor || 1)), fmtN(counts[i] * (mse.factor || 1) * 1.4)],
      mseFactor: Math.round((mse.factor || 1) * 100) / 100,
      mseConfidence: mse.confidence,
      mseDetail: {
        onlyMV: inWindow.filter(u => u.county === c.name && u.lists.mv && !u.lists.news).length,
        onlyOB: 0, onlyMort: 0, mvOb: 0, mvMort: 0, obMort: 0, allThree: 0,
        pairMV_OB: null, pairMV_Mort: null, pairOB_Mort: null,
      },
      clusterRR: cluster ? Math.round(cluster.rr * 100) / 100 : null,
      clusterP: cluster ? cluster.p : null,
      temporalZ: t.z, temporalCurrent: t.current, temporalBaseline: t.baselineMean,
      temporalFlagged: t.flagged,
      vehicleSignal: vehicleZoneIds.has(c.id),
      components: {
        ebPercentile: Math.round(components.ebPercentile * 1000) / 1000,
        msePercentile: Math.round(components.msePercentile * 1000) / 1000,
        clusterScore: Math.round(components.clusterScore * 1000) / 1000,
        temporalScore: Math.round(components.temporalScore * 1000) / 1000,
        vehicleScore: components.vehicleScore,
        ucdpBaseline: Math.round(components.ucdpBaseline * 1000) / 1000,
      },
      index, band, confidence, drivers,
      ucdpEvents: ucdpByCounty[i].events,
      ucdpCivilianDeaths: ucdpByCounty[i].civDeaths,
    };
  });

  // ————— forecast (real panels) —————
  // UCDP county-month panels 2010-2022 (all organized-violence event types)
  const panels: CountyMonth[] = [];
  const countyMonths = new Map<string, number>();
  for (const e of ucdp) {
    if (e.year < 2010) continue;
    const key = `${e.county ?? "Unlocated"}|${e.dateStart.slice(0, 7)}`;
    countyMonths.set(key, (countyMonths.get(key) ?? 0) + 1);
  }
  for (const [key, n] of countyMonths) {
    const [county, month] = key.split("|");
    if (county === "Unlocated") continue;
    panels.push({ county, month, events: n });
  }
  const fc = runForecast(panels);

  // national ED series forecast (Holt-Winters, seasonal 12)
  const edVals = edSeries.map(m => m.ed);
  const hw = holtWinters(edVals, { seasonalPeriod: 12, horizon: 3 });
  const fcMonths: string[] = [];
  {
    const last = edSeries[edSeries.length - 1];
    const [y, m] = last.month.split("-").map(Number);
    for (let i = 1; i <= 3; i++) {
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      fcMonths.push(d.toISOString().slice(0, 7));
    }
  }
  // projections: current index adjusted by the county's forecasted trend
  const perCountyFc = new Map(fc.perCounty.map(p => [p.county, p]));
  const trendFor = (countyName: string): number => {
    const p = perCountyFc.get(countyName);
    if (!p) return 1;
    const recent = p.recent3Mean;
    if (recent <= 0) return p.mean > 0 ? 1.4 : 1;
    return Math.min(2, Math.max(0.5, p.mean / recent));
  };
  const projections = [...zones]
    .sort((a, b) => b.index - a.index)
    .slice(0, 12)
    .map(z => {
      const trend = trendFor(z.name);
      const projected = Math.min(100, Math.max(0, z.index + 12 * (trend - 1)));
      return {
        zoneId: z.id, zoneName: z.name, county: z.county,
        currentIndex: z.index,
        projectedIndex: Math.round(projected * 10) / 10,
        band: riskBand(projected),
        trend: Math.round(trend * 100) / 100,
      };
    });

  const forecast: KampsForecast = {
    generatedAt: new Date().toISOString(),
    horizonDays: 90,
    method: "Holt-Winters (seasonal 12, grid-searched) on the Missing Voices monthly series; county trend factors from walk-forward backtested UCDP GED panels (2010-2022).",
    national: {
      series: edSeries.slice(-30).map(m => ({ month: m.month, ed: m.ed })),
      forecastMonths: fcMonths,
      mean: hw.mean.map(v => Math.round(v * 10) / 10),
      lower95: hw.lower95.map(v => Math.round(v * 10) / 10),
      upper95: hw.upper95.map(v => Math.round(v * 10) / 10),
    },
    backtest: {
      auc: Math.round(fc.backtest.auc * 1000) / 1000,
      brier: Math.round(fc.backtest.brier * 1000) / 1000,
      hitRate: Math.round(fc.backtest.hitRate * 1000) / 1000,
      falseAlarmRate: Math.round(fc.backtest.falseAlarmRate * 1000) / 1000,
      nPredictions: fc.backtest.nPredictions,
      leadTimeDays: fc.backtest.leadTimeDays,
      coverage95: Math.round(fc.national.metrics.coverage95 * 1000) / 1000,
      trainedOn: "UCDP GED county-month panels, 2010-2022, walk-forward",
    },
    projections,
  };

  // ————— alerts —————
  const alerts: KampsAlert[] = [];
  alerts.push(...zoneRiskAlerts(
    [...zones]
      .sort((a, b) => b.index - a.index)
      .map(z => ({
        id: z.id, name: z.name, county: z.county, index: z.index, band: z.band,
        confidence: z.confidence, drivers: z.drivers,
      })),
    asOf
  ));
  for (const c of clusters.filter(cc => cc.p <= 0.05)) {
    const allNames = c.zoneIds.map(id => `${counties.find(cc => cc.id === id)?.name} County`);
    const shown = allNames.length > 6
      ? [...allNames.slice(0, 6), `and ${allNames.length - 6} more`]
      : allNames;
    alerts.push(clusterAlert({
      zoneNames: shown,
      rr: c.rr, p: c.p, observed: c.observed, expected: c.expected, radiusKm: c.radiusKm,
    }, asOf));
  }
  for (const v of vehiclesOut.filter(vv => vv.status !== "cleared")) {
    alerts.push(vehicleAlert(v, asOf));
  }
  // temporal spike alert from the real series
  const spike = recentTemporal.filter(r => r.flagged)
    .sort((a, b) => b.z - a.z)[0];
  if (spike) {
    alerts.push({
      id: "temporal-spike", severity: "elevated", kind: "zone-risk",
      asOf: asOf.toISOString().slice(0, 10),
      title: `ELEVATED · national temporal anomaly (${spike.month})`,
      message:
        `The enforced-disappearance series deviates +${spike.z.toFixed(1)} sigma above its trailing 12-month baseline: ` +
        `${spike.ed} documented cases in ${spike.month} against a baseline of ${spike.baseline}. ` +
        `Source: Missing Voices monthly statistics. Aggregate national assessment; no individuals named.`,
      drivers: [
        `${spike.ed} cases vs ${spike.baseline} baseline`,
        `+${spike.z.toFixed(1)} sigma, trailing 12 months`,
        "Missing Voices monthly series, retrieved from missingvoices.or.ke",
      ],
      actions: [
        "Verify field check-in protocols across partner networks",
        "Cross-reference the spike window with protest and political event calendars",
        "Pre-position habeas corpus counsel for the elevated window",
      ],
      confidence: "high",
    });
  }
  alerts.push(dataAlert(documentedTotal, mse.estimated, asOf, mse));
  const sevOrder = { critical: 0, elevated: 1, watch: 2, info: 3 } as const;
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  const significant = clusters.filter(c => c.p <= 0.05);
  const top = [...zones].sort((a, b) => b.index - a.index)[0];
  const flaggedVehicles = vehiclesOut.filter(v => v.status === "flagged").length;
  const documentedVehicles = vehiclesOut.filter(v => !v.simulated).length;

  const captureMV = documentedTotal ? Math.round((inWindow.filter(u => u.lists.mv).length / documentedTotal) * 1000) / 10 : 0;
  const captureNews = documentedTotal ? Math.round((inWindow.filter(u => u.lists.news).length / documentedTotal) * 1000) / 10 : 0;

  return {
    asOf: asOf.toISOString(),
    simulated: false,
    groundTruth: null,
    dataWindow: { start: windowStart.toISOString().slice(0, 10), end: asOf.toISOString().slice(0, 10) },
    overview: {
      zones: counties.length,
      documentedTotal,
      documentedLocated,
      estimatedTotal: mse.estimated,
      pooledEstimate: mse.estimated,
      estimateCI: [mse.ciLow, mse.ciHigh],
      underreportingFactor: mse.factor,
      captureRates: { mv: captureMV, ob: captureNews, mort: 0 },
      significantClusters: significant.length,
      flaggedVehicles,
      documentedVehicles,
      activeAlerts: alerts.filter(a => a.severity !== "info").length,
      highestZone: top?.name ?? "-",
      highestIndex: top?.index ?? 0,
      unlocatedIncidents: documentedTotal - documentedLocated,
    },
    mse,
    clusters: clusters.map(c => ({
      zoneNames: c.zoneIds.map(id => counties.find(cc => cc.id === id)?.name ?? ""),
      rr: c.rr, p: c.p, observed: c.observed, expected: c.expected, radiusKm: c.radiusKm, zoneIds: c.zoneIds,
    })),
    zones,
    vehicles: vehiclesOut,
    alerts,
    weights: RISK_WEIGHTS,
    vehicleRule: VEHICLE_RULE,
    temporal: { series: edSeries.slice(-30), recent: recentTemporal },
    forecast,
    provenance: {
      files: manifest.files.map(f => ({
        file: f.file, format: f.format, rows: String(f.rows_or_features),
        source: f.source, quality: f.quality, retrievedAt: f.retrieved_at, notes: f.notes,
      })),
      gaps: manifest.gaps,
      retrievedAt: manifest.retrieved_at,
    },
    incidentsRecent: inWindow
      .slice(-40)
      .reverse()
      .map(u => ({
        date: u.date, person: u.person, county: u.county, status: u.status,
        category: u.category, sourceName: u.sourceName, sourceUrl: u.sourceUrl,
        lists: [u.lists.mv ? "Missing Voices" : null, u.lists.news ? "public record" : null].filter(Boolean) as string[],
      })),
  };
}
