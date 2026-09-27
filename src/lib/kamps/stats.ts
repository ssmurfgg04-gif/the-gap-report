/**
 * KAMPS statistical engine.
 *
 * Implements the six-stage analytical pipeline from the implementation plan:
 *   1. crude rates            (incidents / population x 100k)
 *   2. Empirical Bayes        (Poisson-Gamma shrinkage, Marshall global prior)
 *   3. MSE                    (3-list capture-recapture, log-linear MLE + bootstrap CI)
 *   4. spatial scan           (variable-circle scan statistic, Monte Carlo 999)
 *   5. temporal anomaly       (rolling 90-day baseline, z-score)
 *   6. composite risk index   (weighted aggregation, 0-100)
 *
 * Every routine is deterministic (seeded PRNG) so results are reproducible.
 */

// ————— deterministic PRNG —————
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ————— Stage 2: Empirical Bayes smoothing (Poisson-Gamma) —————
export type EBResult = {
  /** posterior mean rate per 100k */
  ratePer100k: number;
  /** posterior sd of the rate per 100k */
  sdPer100k: number;
  /** 95% interval for the rate per 100k */
  ciLow: number;
  ciHigh: number;
};

/**
 * Marshall global-rate smoothing: fit a Gamma(a, b) prior to the zone rates by
 * method of moments (removing Poisson noise from the observed variance), then
 * take posterior means (c_i + a) / (P_i + b).
 */
export function empiricalBayes(counts: number[], populations: number[]): EBResult[] {
  const C = counts.reduce((s, c) => s + c, 0);
  const P = populations.reduce((s, p) => s + p, 0);
  const globalRate = C / P; // per person

  // observed weighted variance of zone rates
  const rates = counts.map((c, i) => c / populations[i]);
  let varObs = 0;
  for (let i = 0; i < counts.length; i++) {
    varObs += populations[i] * (rates[i] - globalRate) ** 2;
  }
  varObs /= P;

  // Poisson sampling variance component: E[s_obs^2] = sigma_sp^2 + (n-1) r / W
  // (Marshall 1991: sampling noise of n zone rates around the global mean)
  const poissonComp = (globalRate * (counts.length - 1)) / P;
  const varSp = Math.max(varObs - poissonComp, 1e-12);

  // Gamma prior: mean a/b = r, var a/b^2 = sigma_sp^2
  const a = Math.min((globalRate * globalRate) / varSp, 1e6);
  const b = a / globalRate;

  return counts.map((c, i) => {
    const postMean = (c + a) / (populations[i] + b);
    const postSd = Math.sqrt(c + a) / (populations[i] + b);
    return {
      ratePer100k: postMean * 1e5,
      sdPer100k: postSd * 1e5,
      ciLow: Math.max(0, (postMean - 1.96 * postSd) * 1e5),
      ciHigh: (postMean + 1.96 * postSd) * 1e5,
    };
  });
}

// ————— Stage 3: Multiple Systems Estimation (3-list capture-recapture) —————
export type MSEResult = {
  /** documented (captured by >= 1 list) */
  documented: number;
  /** estimated true total, log-linear independence MLE */
  estimated: number;
  /** bootstrap 95% interval */
  ciLow: number;
  ciHigh: number;
  /** estimated / documented */
  factor: number;
  /** capture probability per list */
  pMV: number;
  pOB: number;
  pMort: number;
  /** pairwise Chapman estimates for reference */
  pairMV_OB: number | null;
  pairMV_Mort: number | null;
  pairOB_Mort: number | null;
  /** overlap counts for the Venn diagram */
  onlyMV: number;
  onlyOB: number;
  onlyMort: number;
  mvOb: number;
  mvMort: number;
  obMort: number;
  allThree: number;
  /** reliability of the estimate */
  confidence: "high" | "medium" | "low";
};

type Capture = { mv: boolean; ob: boolean; mort: boolean };

/** Chapman estimator for two lists (unbiased Lincoln-Petersen). */
function chapman(nA: number, nB: number, nAB: number): number | null {
  if (nAB === 0) return null; // no overlap: estimator undefined / infinite
  return ((nA + 1) * (nB + 1)) / (nAB + 1) - 1;
}

/** Log-linear independence MLE for three lists via fixed-point iteration. */
function threeListMLE(D: number, nMV: number, nOB: number, nMort: number): number {
  // start from plug-in
  let N = D / (1 - (1 - nMV / D) * (1 - nOB / D) * (1 - nMort / D));
  for (let it = 0; it < 100; it++) {
    const pMV = nMV / N, pOB = nOB / N, pMort = nMort / N;
    const missed = (1 - pMV) * (1 - pOB) * (1 - pMort);
    if (missed >= 1 - 1e-12) return N;
    const next = D / (1 - missed);
    if (Math.abs(next - N) < 0.01) { N = next; break; }
    N = next;
  }
  return Math.min(N, D * 8); // sanity cap
}

export function runMSE(captures: Capture[]): MSEResult {
  const D = captures.length;
  let nMV = 0, nOB = 0, nMort = 0;
  let mvOb = 0, mvMort = 0, obMort = 0, allThree = 0;
  for (const c of captures) {
    if (c.mv) nMV++;
    if (c.ob) nOB++;
    if (c.mort) nMort++;
    if (c.mv && c.ob) mvOb++;
    if (c.mv && c.mort) mvMort++;
    if (c.ob && c.mort) obMort++;
    if (c.mv && c.ob && c.mort) allThree++;
  }
  const onlyMV = nMV - mvOb - mvMort + allThree;
  const onlyOB = nOB - mvOb - obMort + allThree;
  const onlyMort = nMort - mvMort - obMort + allThree;

  const pairMV_OB = chapman(nMV, nOB, mvOb);
  const pairMV_Mort = chapman(nMV, nMort, mvMort);
  const pairOB_Mort = chapman(nOB, nMort, obMort);

  let estimated: number;
  let ciLow: number, ciHigh: number;
  let confidence: MSEResult["confidence"] = "low";

  if (D < 8) {
    // too thin for stable estimation: wide, honest interval instead
    estimated = D * 1.5;
    ciLow = D;
    ciHigh = D * 3;
    confidence = "low";
  } else {
    estimated = threeListMLE(D, nMV, nOB, nMort);
    estimated = Math.max(estimated, D);

    // bootstrap the capture patterns (resample documented rows with replacement)
    const rng = mulberry32(D * 7919 + nMV * 31 + 17);
    const reps: number[] = [];
    for (let r = 0; r < 400; r++) {
      let dMV = 0, dOB = 0, dMort = 0;
      for (let i = 0; i < D; i++) {
        const c = captures[Math.floor(rng() * D)];
        if (c.mv) dMV++;
        if (c.ob) dOB++;
        if (c.mort) dMort++;
      }
      reps.push(threeListMLE(D, dMV, dOB, dMort));
    }
    reps.sort((x, y) => x - y);
    ciLow = Math.max(D, reps[Math.floor(0.025 * reps.length)]);
    ciHigh = Math.max(ciLow + 1, reps[Math.ceil(0.975 * reps.length) - 1]);
    confidence = D >= 25 ? "high" : D >= 12 ? "medium" : "low";
  }

  return {
    documented: D,
    estimated: Math.round(estimated),
    ciLow: Math.round(ciLow),
    ciHigh: Math.round(ciHigh),
    factor: estimated / Math.max(D, 1),
    pMV: D ? nMV / D : 0,
    pOB: D ? nOB / D : 0,
    pMort: D ? nMort / D : 0,
    pairMV_OB: pairMV_OB ? Math.round(pairMV_OB) : null,
    pairMV_Mort: pairMV_Mort ? Math.round(pairMV_Mort) : null,
    pairOB_Mort: pairOB_Mort ? Math.round(pairOB_Mort) : null,
    onlyMV, onlyOB, onlyMort, mvOb, mvMort, obMort, allThree,
    confidence,
  };
}

// ————— Stage 4: spatial scan statistic —————
export type ScanCluster = {
  zoneIds: number[];
  observed: number;
  expected: number;
  /** relative risk inside vs outside */
  rr: number;
  llr: number;
  /** Monte Carlo p-value (999 replications) */
  p: number;
  /** cluster radius km (circle that generated it) */
  radiusKm: number;
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function poissonLLR(observed: number, expected: number, totalC: number, totalE: number): number {
  if (observed <= expected) return 0;
  const O = observed, E = expected;
  const CO = totalC - O, CE = totalE - E;
  const l1 = O > 0 ? O * Math.log(O / E) : 0;
  const l2 = CO > 0 && CE > 0 ? CO * Math.log(CO / CE) : CO === 0 ? 0 : -Infinity;
  if (!isFinite(l2)) return l1; // outside is zero cases
  return l1 + Math.max(l2, 0);
}

/**
 * Variable-circle spatial scan statistic (Kulldorff, Poisson, high-rate only)
 * with 999 Monte Carlo replications, population-conditioned.
 */
export function spatialScan(
  zones: { id: number; lat: number; lng: number; population: number; cases: number }[]
): ScanCluster[] {
  const totalPop = zones.reduce((s, z) => s + z.population, 0);
  const totalCases = zones.reduce((s, z) => s + z.cases, 0);
  if (totalCases <= 0 || zones.length < 3) return [];

  const dist = (i: number, j: number) => haversineKm(zones[i].lat, zones[i].lng, zones[j].lat, zones[j].lng);

  // candidate circles: center each zone, radius grid
  const radii = [40, 80, 130, 200, 280];
  const seen = new Set<string>();
  type Circle = { memberIdx: number[]; radiusKm: number };
  const circles: Circle[] = [];
  for (let i = 0; i < zones.length; i++) {
    for (const r of radii) {
      const memberIdx: number[] = [];
      let pop = 0;
      for (let j = 0; j < zones.length; j++) {
        if (dist(i, j) <= r) { memberIdx.push(j); pop += zones[j].population; }
      }
      // cap: up to 50% of population at risk
      if (pop > totalPop * 0.5) continue;
      const sig = memberIdx.join(",");
      if (seen.has(sig)) continue;
      seen.add(sig);
      circles.push({ memberIdx, radiusKm: r });
    }
  }
  if (circles.length === 0) return [];

  const expectedFor = (memberIdx: number[]) => {
    let pop = 0;
    for (const j of memberIdx) pop += zones[j].population;
    return (pop / totalPop) * totalCases;
  };
  const observedFor = (memberIdx: number[], cases: number[]) => {
    let o = 0;
    for (const j of memberIdx) o += cases[j];
    return o;
  };
  const llrFor = (memberIdx: number[], cases: number[]) =>
    poissonLLR(observedFor(memberIdx, cases), expectedFor(memberIdx), totalCases, totalCases);

  const baseCases = zones.map(z => z.cases);
  const bestCircle = (cases: number[]): { circle: Circle | null; llr: number } => {
    let best: Circle | null = null, bestLLR = 0;
    for (const c of circles) {
      const llr = llrFor(c.memberIdx, cases);
      if (llr > bestLLR) { bestLLR = llr; best = c; }
    }
    return { circle: best, llr: bestLLR };
  };

  const observedCases = baseCases;
  const { circle: primary, llr: obsLLR } = bestCircle(observedCases);
  if (!primary) return [];

  // Monte Carlo: condition on total cases, allocate by population.
  // We retain the full distribution of the max LLR under the null so that
  // secondary clusters can also be scored against it (conservative inference,
  // as in SaTScan's secondary-cluster reporting).
  const rng = mulberry32(424242);
  let exceed = 0;
  const nullLLRs: number[] = [];
  for (let rep = 0; rep < 999; rep++) {
    // multinomial draw proportional to population
    const simCases = zones.map(() => 0);
    const cum: number[] = [];
    let acc = 0;
    for (let j = 0; j < zones.length; j++) {
      acc += zones[j].population / totalPop;
      cum[j] = acc;
    }
    for (let k = 0; k < totalCases; k++) {
      const u = rng();
      let j = 0;
      while (j < zones.length - 1 && u > cum[j]) j++;
      simCases[j]++;
    }
    const { llr } = bestCircle(simCases);
    nullLLRs.push(llr);
    if (llr >= obsLLR - 1e-9) exceed++;
  }
  const pValue = (1 + exceed) / 1000;
  const pFor = (llr: number) => (1 + nullLLRs.filter(l => l >= llr - 1e-9).length) / 1000;

  const mkCluster = (circle: Circle, p: number): ScanCluster => {
    const O = observedFor(circle.memberIdx, observedCases);
    const E = expectedFor(circle.memberIdx);
    const inside = O / Math.max(E, 1e-9);
    const outside = (totalCases - O) / Math.max(totalCases - E, 1e-9);
    return {
      zoneIds: circle.memberIdx.map(j => zones[j].id),
      observed: Math.round(O * 10) / 10,
      expected: Math.round(E * 10) / 10,
      rr: Math.max(inside / Math.max(outside, 1e-9), 1),
      llr: Math.round(llrFor(circle.memberIdx, observedCases) * 100) / 100,
      p,
      radiusKm: circle.radiusKm,
    };
  };

  // primary + greedy non-overlapping secondary clusters
  const clusters: ScanCluster[] = [];
  if (obsLLR > 0) clusters.push(mkCluster(primary, pValue));

  const used = new Set(primary.memberIdx);
  for (let pass = 0; pass < 2 && clusters.length < 3; pass++) {
    let best: Circle | null = null, bestLLR = 0;
    for (const c of circles) {
      if (c.memberIdx.some(j => used.has(j))) continue;
      const llr = llrFor(c.memberIdx, observedCases);
      if (llr > bestLLR) { bestLLR = llr; best = c; }
    }
    if (!best || bestLLR <= 0) break;
    clusters.push(mkCluster(best, pFor(bestLLR)));
    best.memberIdx.forEach(j => used.add(j));
  }

  return clusters.filter((c, i) => i === 0 || c.p <= 0.05);
}

// ————— Stage 5: temporal anomaly detection —————
export type TemporalResult = {
  current: number;
  baselineMean: number;
  z: number;
  flagged: boolean;
};

export function temporalAnomaly(
  dates: Date[],
  asOf: Date,
  windowDays = 90,
  nBaselines = 5
): TemporalResult {
  const DAY = 86400000;
  const inWindow = (start: number, end: number) =>
    dates.filter(d => { const t = d.getTime(); return t >= start && t < end; }).length;

  const end = asOf.getTime();
  const current = inWindow(end - windowDays * DAY, end);
  let sum = 0, sumSq = 0, n = 0;
  for (let w = 1; w <= nBaselines; w++) {
    const c = inWindow(end - (w + 1) * windowDays * DAY, end - w * windowDays * DAY);
    sum += c; sumSq += c * c; n++;
  }
  const mean = n ? sum / n : 0;
  const variance = n > 1 ? (sumSq - n * mean * mean) / (n - 1) : 0;
  const sd = Math.max(Math.sqrt(Math.max(variance, 0)), 0.6);
  const z = (current - mean) / sd;
  return {
    current,
    baselineMean: Math.round(mean * 10) / 10,
    z: Math.round(z * 100) / 100,
    flagged: z >= 2,
  };
}

// ————— Stage 6: composite risk index —————
export type RiskComponents = {
  ebPercentile: number;      // 0-1
  msePercentile: number;     // 0-1
  clusterScore: number;      // 0-1
  temporalScore: number;     // 0-1
  vehicleScore: number;      // 0-1
  ucdpBaseline: number;      // 0-1 (historical organized-violence burden, UCDP)
};

export const RISK_WEIGHTS = {
  ebRate: 0.28,
  mseAdjusted: 0.12,
  cluster: 0.22,
  ucdpBaseline: 0.2,
  temporal: 0.1,
  vehicle: 0.08,
} as const;

export function compositeRisk(c: RiskComponents): number {
  const score =
    RISK_WEIGHTS.ebRate * c.ebPercentile +
    RISK_WEIGHTS.mseAdjusted * c.msePercentile +
    RISK_WEIGHTS.cluster * c.clusterScore +
    RISK_WEIGHTS.ucdpBaseline * c.ucdpBaseline +
    RISK_WEIGHTS.temporal * c.temporalScore +
    RISK_WEIGHTS.vehicle * c.vehicleScore;
  return Math.round(score * 1000) / 10; // 0-100
}

export type RiskBand = "critical" | "elevated" | "watch" | "baseline";

export function riskBand(index: number): RiskBand {
  if (index >= 75) return "critical";
  if (index >= 60) return "elevated";
  if (index >= 45) return "watch";
  return "baseline";
}

export function percentileRanks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return values.map(v => {
    let below = 0, equal = 0;
    for (const s of sorted) {
      if (s < v) below++;
      else if (s === v) equal++;
    }
    if (n <= 1) return 0.5;
    return equal > 1 ? (below + (equal - 1) / 2) / (n - 1) : below / (n - 1);
  });
}
