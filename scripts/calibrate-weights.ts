/**
 * KAMPS risk-weight calibration (2026-09-27).
 *
 * Walk-forward evaluation: build county risk components using only incidents
 * before a cutoff, then test how well the weighted index predicts counties
 * that actually record incidents after the cutoff. Coordinate ascent over
 * the weight simplex maximizes mean AUC + 0.5 * |Spearman| across folds.
 *
 * Folds (window starts 2024-06-01, matching the engine):
 *   F1: cutoff 2026-01-01, target (2026-01-01 .. 2026-09-27]
 *   F2: cutoff 2025-07-01, target (2025-07-01 .. 2026-09-27]
 *
 * Components per county (computed identically to engine.ts but at cutoff):
 *   ebPct       Empirical-Bayes rate percentile
 *   msePct      rate x national MSE factor percentile (proportional to crude)
 *   cluster     spatial scan RR score
 *   temporal    90-day z-score at cutoff
 *   vehicle     documented pattern-vehicle sighting county
 *   ucdp        UCDP 2013+ deaths-per-100k percentile
 */
import {
  loadCounties, loadMissingVoices, loadPublicRecordIncidents, loadUcdp, loadVehicleCases,
} from "../src/lib/kamps/real-data";
import {
  empiricalBayes, spatialScan, temporalAnomaly, percentileRanks, RISK_WEIGHTS,
} from "../src/lib/kamps/stats";

type Components = {
  ebPct: number; msePct: number; cluster: number;
  temporal: number; vehicle: number; ucdp: number;
};

const countylat = (name: string): { lat: number; lng: number } => {
  // county centroids from the GeoJSON would be heavier; use a compact table
  // of county centroids (2019 census centers, approximate)
  const c: Record<string, [number, number]> = {
    "Baringo": [0.47, 35.97], "Bomet": [-0.78, 35.35], "Bungoma": [0.57, 34.56],
    "Busia": [0.46, 34.11], "Elgeyo Marakwet": [0.52, 35.42], "Embu": [-0.53, 37.45],
    "Garissa": [0.46, 39.64], "Homa Bay": [-0.53, 34.46], "Isiolo": [0.52, 38.5],
    "Kajiado": [-2.1, 36.78], "Kakamega": [0.28, 34.75], "Kericho": [-0.37, 35.29],
    "Kiambu": [-1.17, 36.83], "Kilifi": [-3.63, 39.85], "Kirinyaga": [-0.5, 37.31],
    "Kisii": [-0.68, 34.78], "Kisumu": [-0.09, 34.77], "Kitui": [-1.37, 38.01],
    "Kwale": [-4.18, 39.45], "Laikipia": [0.22, 36.94], "Lamu": [-2.27, 40.9],
    "Machakos": [-1.54, 37.26], "Makueni": [-1.8, 37.62], "Mandera": [3.04, 41.87],
    "Marsabit": [2.45, 37.99], "Meru": [0.05, 37.65], "Migori": [-1.07, 34.47],
    "Mombasa": [-4.05, 39.66], "Murang'a": [-0.72, 37.15], "Nairobi": [-1.29, 36.82],
    "Nakuru": [-0.28, 36.07], "Nandi": [0.1, 35.1], "Narok": [-1.09, 35.87],
    "Nyamira": [-0.53, 34.93], "Nyandarua": [-0.18, 36.79], "Nyeri": [-0.42, 36.95],
    "Samburu": [1.06, 37.28], "Siaya": [0.06, 34.29], "Taita Taveta": [-3.4, 38.36],
    "Tana River": [-1.5, 39.65], "Tharaka Nithi": [-0.29, 37.92], "Trans Nzoia": [1.02, 34.95],
    "Turkana": [3.14, 35.6], "Uasin Gishu": [0.51, 35.27], "Vihiga": [0.06, 34.72],
    "West Pokot": [1.6, 35.11],
  };
  const [lat, lng] = c[name] ?? [0, 37];
  return { lat, lng };
};

// ---------- load data ----------
const counties = loadCounties();
const { victims: mvVictims } = loadMissingVoices();
const prIncidents = loadPublicRecordIncidents();
const ucdp = loadUcdp();
const vehicleCases = loadVehicleCases();

// incident universe (MV + public record, no ER dedup needed for county-level counts
// since ER pairs collapse across lists, not counties; keep it simple and honest)
type Incident = { date: string; county: string | null; lists: { mv: boolean; news: boolean } };
const incidents: Incident[] = [
  ...mvVictims.map(v => ({ date: v.date!, county: v.county, lists: { mv: true, news: false } })),
  ...prIncidents.map(p => ({ date: p.date, county: p.county, lists: { mv: false, news: true } })),
];

// UCDP covariate (fixed through 2025)
const ucdpDecade = ucdp.filter(e => e.year >= 2013);
const ucdpRate = counties.map(c => {
  const evs = ucdpDecade.filter(e => e.county === c.name);
  return evs.reduce((s, e) => s + e.best, 0) / (c.population / 1e5);
});
const ucdpPct = percentileRanks(ucdpRate);

// vehicle counties (all documented sightings)
const vehicleCounties = new Set<string>();
for (const vc of vehicleCases) for (const s of vc.sightings) vehicleCounties.add(s.zoneName);

const nationalMseFactor = 1.4; // engine's current two-list factor (documented); only scales uniformly

// ---------- fold builder ----------
function buildFold(cutoff: string, targetEnd: string) {
  const cutoffT = new Date(cutoff).getTime();
  const startT = new Date("2024-06-01").getTime();
  const past = incidents.filter(i => {
    const t = new Date(i.date).getTime();
    return t >= startT && t <= cutoffT;
  });
  const future = incidents.filter(i => {
    const t = new Date(i.date).getTime();
    return t > cutoffT && t <= new Date(targetEnd).getTime();
  });

  const counts = counties.map(c => past.filter(i => i.county === c.name).length);
  const pops = counties.map(c => c.population);
  const eb = empiricalBayes(counts, pops);
  const ebPct = percentileRanks(eb.map(e => e.ratePer100k));
  const msePct = percentileRanks(counts.map((n, i) => (n * nationalMseFactor) / (pops[i] / 1e5)));

  const scanInput = counties.map((c, i) => ({ ...countylat(c.name), id: c.id, population: c.population, cases: counts[i] }));
  const clusters = spatialScan(scanInput);
  const zoneCluster = new Map<number, number>();
  for (const cl of clusters) for (const id of cl.zoneIds) zoneCluster.set(id, Math.max(zoneCluster.get(id) ?? 0, cl.rr));

  const asOfCutoff = new Date(cutoff);
  const temporal = counties.map(c =>
    temporalAnomaly(past.filter(i => i.county === c.name).map(i => new Date(i.date)), asOfCutoff)
  );

  const comps: Components[] = counties.map((c, i) => ({
    ebPct: ebPct[i],
    msePct: msePct[i],
    cluster: Math.min(1, Math.max(0, ((zoneCluster.get(c.id) ?? 1) - 1) / 3)),
    temporal: Math.min(1, Math.max(0, (temporal[i].z - 1) / 2.5)),
    vehicle: vehicleCounties.has(c.name) ? 1 : 0,
    ucdp: ucdpPct[i],
  }));

  const futureCounts = counties.map(c => future.filter(i => i.county === c.name).length);
  return { comps, futureCounts, nPast: past.length, nFuture: future.length };
}

// ---------- metrics ----------
function auc(scores: number[], labels: number[]): number {
  const pos = scores.filter((_, i) => labels[i] === 1);
  const neg = scores.filter((_, i) => labels[i] === 0);
  if (!pos.length || !neg.length) return 0.5;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}
function spearman(x: number[], y: number[]): number {
  const rank = (a: number[]) => {
    const idx = a.map((v, i) => [v, i] as [number, number]).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(a.length).fill(0);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(x), ry = rank(y);
  const n = x.length;
  const mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

type Weights = { ebRate: number; mseAdjusted: number; cluster: number; ucdpBaseline: number; temporal: number; vehicle: number };
const KEY_ORDER: (keyof Weights)[] = ["ebRate", "mseAdjusted", "cluster", "ucdpBaseline", "temporal", "vehicle"];

function score(w: Weights, folds: ReturnType<typeof buildFold>[]): number {
  let total = 0;
  for (const f of folds) {
    const s = f.comps.map(c =>
      w.ebRate * c.ebPct + w.mseAdjusted * c.msePct + w.cluster * c.cluster +
      w.ucdpBaseline * c.ucdp + w.temporal * c.temporal + w.vehicle * c.vehicle
    );
    const labels = f.futureCounts.map(n => (n >= 1 ? 1 : 0));
    total += auc(s, labels) + 0.5 * Math.abs(spearman(s, f.futureCounts));
  }
  return total / folds.length;
}

function normalize(w: Weights): Weights {
  const sum = KEY_ORDER.reduce((s, k) => s + Math.max(0, w[k]), 0) || 1;
  const out = {} as Weights;
  for (const k of KEY_ORDER) out[k] = Math.round((Math.max(0, w[k]) / sum) * 1000) / 1000;
  // fix rounding drift on the largest
  const drift = 1 - KEY_ORDER.reduce((s, k) => s + out[k], 0);
  const big = KEY_ORDER.reduce((a, b) => (out[a] >= out[b] ? a : b));
  out[big] = Math.round((out[big] + drift) * 1000) / 1000;
  return out;
}

// ---------- folds ----------
const folds = [
  buildFold("2026-01-01", "2026-09-27"),
  buildFold("2025-07-01", "2026-09-27"),
];
for (const f of folds) console.log(`fold: past=${f.nPast} future=${f.nFuture} positive counties=${f.futureCounts.filter(n => n > 0).length}`);

const current = { ...RISK_WEIGHTS } as Weights;
console.log("current weights:", current, "objective:", score(current, folds).toFixed(4));

// coordinate ascent
let best = normalize(current);
let bestScore = score(best, folds);
const STEP = 0.04;
for (let iter = 0; iter < 60; iter++) {
  let improved = false;
  for (const k of KEY_ORDER) {
    for (const dir of [1, -1]) {
      const trial = { ...best };
      trial[k] = Math.round((best[k] + dir * STEP) * 100) / 100;
      const cand = normalize(trial);
      const s = score(cand, folds);
      if (s > bestScore + 1e-6) { best = cand; bestScore = s; improved = true; }
    }
  }
  if (!improved) break;
}
console.log("tuned weights: ", best, "objective:", bestScore.toFixed(4));

// report per-fold AUC for both
for (const [name, w] of [["current", current], ["tuned", best]] as const) {
  const perFold = folds.map(f => {
    const s = f.comps.map(c =>
      w.ebRate * c.ebPct + w.mseAdjusted * c.msePct + w.cluster * c.cluster +
      w.ucdpBaseline * c.ucdp + w.temporal * c.temporal + w.vehicle * c.vehicle
    );
    const labels = f.futureCounts.map(n => (n >= 1 ? 1 : 0));
    return `AUC=${auc(s, labels).toFixed(3)} rho=${spearman(s, f.futureCounts).toFixed(3)}`;
  });
  console.log(name, "->", perFold.join(" | "));
}

// ---------- expert-floored variant (keeps plan-mandated floors) ----------
const floored: Weights = normalize({
  ebRate: 0.30, mseAdjusted: 0.16, cluster: 0.28,
  ucdpBaseline: 0.10, temporal: 0.10, vehicle: 0.06,
});
console.log("floored weights:", floored, "objective:", score(floored, folds).toFixed(4));
{
  const perFold = folds.map(f => {
    const s = f.comps.map(c =>
      floored.ebRate * c.ebPct + floored.mseAdjusted * c.msePct + floored.cluster * c.cluster +
      floored.ucdpBaseline * c.ucdp + floored.temporal * c.temporal + floored.vehicle * c.vehicle
    );
    const labels = f.futureCounts.map(n => (n >= 1 ? 1 : 0));
    return `AUC=${auc(s, labels).toFixed(3)} rho=${spearman(s, f.futureCounts).toFixed(3)}`;
  });
  console.log("floored ->", perFold.join(" | "));
}
