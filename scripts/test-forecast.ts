/**
 * KAMPS forecast / entity-resolution test harness.
 *
 * Builds a deterministic synthetic panel (36 months x 8 counties, trend +
 * seasonality + overdispersed Poisson noise), runs runForecast + backtest,
 * exercises holtWinters, then runs matchRecords on two overlapping incident
 * lists and capturePatternMatrix on three partially-capturing lists.
 *
 * Run: bun /home/z/my-project/scripts/test-forecast.ts
 * Exits 0 when all sanity checks pass.
 */
import {
  runForecast,
  holtWinters,
  backtest,
  type CountyMonth,
} from "../src/lib/kamps/forecast";
import {
  jaroWinkler,
  matchRecords,
  capturePatternMatrix,
  type ERRecord,
} from "../src/lib/kamps/er";

// ————— deterministic PRNG (same algorithm as the rest of KAMPS) —————
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260930);

/** Knuth Poisson draw (small lambda). */
function poisson(lambda: number): number {
  const L = Math.exp(-Math.max(0, lambda));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// ————— synthetic panel —————
const N_MONTHS = 36;
const START = { y: 2023, m: 1 }; // 2023-01 .. 2025-12
const monthLabel = (i: number): string => {
  const z = START.y * 12 + (START.m - 1) + i;
  const y = Math.floor(z / 12);
  const m = (z % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
};

type CountySpec = {
  name: string;
  base: number;
  growth: number;
  seasonal: number;
  phase: number;
};

const specs: CountySpec[] = [
  { name: "Nairobi", base: 6.0, growth: 1.045, seasonal: 0.25, phase: 0 },
  { name: "Kiambu", base: 5.0, growth: 1.05, seasonal: 0.2, phase: 2 },
  { name: "Nakuru", base: 7.0, growth: 1.01, seasonal: 0.3, phase: 1 },
  { name: "Kisumu", base: 6.0, growth: 1.0, seasonal: 0.35, phase: 4 },
  { name: "Mombasa", base: 4.0, growth: 1.005, seasonal: 0.4, phase: 3 },
  { name: "Nyeri", base: 3.0, growth: 0.995, seasonal: 0.3, phase: 5 },
  { name: "Garissa", base: 2.5, growth: 1.04, seasonal: 0.15, phase: 6 },
  { name: "Turkana", base: 2.0, growth: 1.0, seasonal: 0.2, phase: 7 },
];

// true intensities (for reporting only)
const trueLambda = (c: CountySpec, t: number): number => {
  const season = 1 + c.seasonal * Math.sin((2 * Math.PI * (t + c.phase)) / 12);
  return c.base * Math.pow(c.growth, t) * season + 0.5;
};

const panels: CountyMonth[] = [];
for (const c of specs) {
  for (let t = 0; t < N_MONTHS; t++) {
    const noise = rng() + rng(); // mean 1, var 1/6 — mild overdispersion
    const events = poisson(trueLambda(c, t) * noise);
    panels.push({ county: c.name, month: monthLabel(t), events });
  }
}

let failures = 0;
const check = (label: string, ok: boolean, detail: string): void => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label} — ${detail}`);
  if (!ok) failures++;
};

// ————— 1. runForecast —————
console.log("=".repeat(72));
console.log("KAMPS FORECAST TEST (deterministic synthetic panel)");
console.log("=".repeat(72));
const rf = runForecast(panels);

console.log("\nNational Poisson-Gamma log-linear forecast (3-month horizon):");
console.log(`  last observed month: ${rf.national.lastMonth}`);
rf.national.forecastMonths.forEach((m, i) => {
  console.log(
    `  ${m}: mean ${rf.national.mean[i].toFixed(1)}  95% PI [${rf.national.lower95[i]}, ${rf.national.upper95[i]}]`
  );
});
console.log(
  `  walk-forward one-step metrics: MAE ${rf.national.metrics.mae}  RMSE ${rf.national.metrics.rmse}  coverage95 ${(rf.national.metrics.coverage95 * 100).toFixed(1)}%  (n=${rf.national.metrics.nSteps})`
);

console.log("\nTop counties by predicted next-month mean (95% PI):");
for (const c of rf.perCounty) {
  console.log(
    `  ${c.county.padEnd(10)} ${c.nextMonth}: mean ${c.mean.toFixed(1)}  [${c.lower95}, ${c.upper95}]  last ${c.lastEvents}  recent3 ${c.recent3Mean}`
  );
}

console.log(`\nBacktest (walk-forward, train 12 months, next-month horizon):`);
console.log(
  `  AUC ${rf.backtest.auc.toFixed(3)}  Brier ${rf.backtest.brier.toFixed(3)}  hitRate ${rf.backtest.hitRate.toFixed(3)}  falseAlarmRate ${rf.backtest.falseAlarmRate.toFixed(3)}  n=${rf.backtest.nPredictions}  leadTime ${rf.backtest.leadTimeDays}d`
);
console.log(`  (nElevated ${rf.backtest.nElevated}, nFlags ${rf.backtest.nFlags}, flag threshold p>=${rf.backtest.flagThreshold})`);

check(
  "backtest AUC in [0.60, 0.95]",
  rf.backtest.auc >= 0.6 && rf.backtest.auc <= 0.95,
  `AUC ${rf.backtest.auc.toFixed(3)}`
);
check(
  "national 95% interval coverage in [0.85, 1.00]",
  rf.national.metrics.coverage95 >= 0.85 && rf.national.metrics.coverage95 <= 1.0,
  `coverage ${(rf.national.metrics.coverage95 * 100).toFixed(1)}% of ${rf.national.metrics.nSteps} steps`
);
check(
  "brier < 0.25 and nPredictions > 100",
  rf.backtest.brier < 0.25 && rf.backtest.nPredictions > 100,
  `brier ${rf.backtest.brier.toFixed(3)}, n ${rf.backtest.nPredictions}`
);
check(
  "top county is a high-growth county (Nairobi/Kiambu/Garissa)",
  ["Nairobi", "Kiambu", "Garissa"].includes(rf.perCounty[0]?.county ?? ""),
  `top = ${rf.perCounty[0]?.county}`
);
check(
  "leadTimeDays ~ 15 (issue at month end, target midpoint)",
  rf.backtest.leadTimeDays >= 14 && rf.backtest.leadTimeDays <= 16,
  `leadTime ${rf.backtest.leadTimeDays}d`
);

// ————— 2. direct API spot checks —————
console.log("\nDirect API spot checks:");
const bt = backtest(panels, { trainMonths: 18, horizon: 1 });
console.log(`  backtest(trainMonths=18): AUC ${bt.auc.toFixed(3)}  brier ${bt.brier.toFixed(3)}  n ${bt.nPredictions}`);
check(
  "backtest deterministic (same opts -> same AUC)",
  bt.auc === backtest(panels, { trainMonths: 18, horizon: 1 }).auc,
  `AUC ${bt.auc.toFixed(6)}`
);

const nationalSeries = Array.from({ length: N_MONTHS }, (_, t) =>
  panels.filter((p) => p.month === monthLabel(t)).reduce((s, p) => s + p.events, 0)
);
const hw = holtWinters(nationalSeries, { horizon: 3 });
console.log(
  `  holtWinters(national): alpha ${hw.params.alpha} beta ${hw.params.beta} gamma ${hw.params.gamma} (gridSearched=${hw.gridSearched})  residSd ${hw.residualSd.toFixed(2)}  MAE ${hw.mae.toFixed(2)}`
);
console.log(
  `  HW forecast: ${hw.mean.map((v, i) => `${v.toFixed(1)} [${hw.lower95[i].toFixed(1)}, ${hw.upper95[i].toFixed(1)}]`).join(" | ")}`
);
check(
  "Holt-Winters MAE below 30% of mean level",
  hw.mae < 0.3 * (nationalSeries.reduce((s, v) => s + v, 0) / nationalSeries.length),
  `MAE ${hw.mae.toFixed(2)} vs mean level ${(nationalSeries.reduce((s, v) => s + v, 0) / nationalSeries.length).toFixed(1)}`
);
const hwFixed = holtWinters(nationalSeries, { alpha: 0.3, beta: 0.1, gamma: 0.1, horizon: 3 });
check(
  "holtWinters honors fixed hyperparameters",
  hwFixed.params.alpha === 0.3 && hwFixed.params.beta === 0.1 && hwFixed.params.gamma === 0.1 && !hwFixed.gridSearched,
  `params ${hwFixed.params.alpha}/${hwFixed.params.beta}/${hwFixed.params.gamma}`
);

// ————— 3. entity resolution —————
console.log("\n" + "=".repeat(72));
console.log("ENTITY RESOLUTION TEST");
console.log("=".repeat(72));

console.log("\nJaro-Winkler sanity:");
const jwPairs: Array<[string, string, number]> = [
  ["Grace Wanjiku", "GRACE Wanjiku", 1.0],
  ["Peter Otieno Ochieng", "Peter Oteno Ochieng", 0.9],
  ["Mary Njeri Kamau", "Maru Njeri Kamau", 0.9],
  ["John Wafula", "Completely Different Name", 0.5],
];
for (const [a, b, _] of jwPairs) {
  console.log(`  JW(${JSON.stringify(a)}, ${JSON.stringify(b)}) = ${jaroWinkler(a, b).toFixed(3)}`);
}
check("JW identical (case/punct) = 1", jaroWinkler("Grace Wanjiku", "GRACE  Wanjiku!") === 1, "normalization ok");
check("JW typo >= 0.85", jaroWinkler("Peter Otieno Ochieng", "Peter Oteno Ochieng") >= 0.85, "single-char drop");
check("JW unrelated < 0.6", jaroWinkler("John Wafula", "Completely Different Name") < 0.6, "low similarity");

// synthetic incident entities
const FIRST = ["Grace", "Peter", "Mary", "John", "Faith", "Samuel", "Naomi", "Daniel", "Esther", "Collins",
  "Winnie", "Bernard", "Agnes", "Victor", "Rose", "Simon", "Joyce", "Martin", "Lydia", "Erick"];
const MIDDLE = ["Wanjiku", "Otieno", "Kamau", "Achieng", "Mutua", "Njeri", "Omondi", "Wafula", "Chebet", "Kilonzo",
  "Mumbi", "Odhiambo", "Njoroge", "Anyango", "Kariuki", "Atieno", "Mwangi", "Wairimu", "Kiptoo", "Owino"];
const LAST = ["Kamau", "Ochieng", "Njoroge", "Wafula", "Mutiso", "Barasa", "Kirui", "Maina", "Odoyo", "Chege",
  "Otieno", "Wanjala", "Mbugua", "Onyango", "Kipteng", "Njau", "Wekesa", "Andayi", "Mwangi", "Ouma"];
const CENTROIDS: Record<string, [number, number]> = {
  Nairobi: [-1.28, 36.82], Kiambu: [-1.15, 36.97], Nakuru: [-0.28, 36.06],
  Kisumu: [-0.09, 34.77], Mombasa: [-4.04, 39.7], Nyeri: [-0.42, 36.95],
  Garissa: [0.46, 39.64], Turkana: [2.49, 35.6],
};
const COUNTY_NAMES = Object.keys(CENTROIDS);
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

const randDate = (): Date => {
  const t = Date.UTC(2024, 0, 1) + Math.floor(rng() * 545) * 86_400_000; // 2024-01-01 .. 2025-06-30
  return new Date(t);
};

const shiftDays = (d: string, k: number): string => {
  const t = Date.parse(d) + k * 86_400_000;
  return isoDate(new Date(t));
};

const typo = (name: string): string => {
  if (name.length < 6) return name;
  const mode = Math.floor(rng() * 3);
  const i = 1 + Math.floor(rng() * (name.length - 2));
  if (mode === 0) {
    // swap adjacent characters
    return name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
  }
  if (mode === 1) {
    // drop a character
    return name.slice(0, i) + name.slice(i + 1);
  }
  // duplicate a character
  return name.slice(0, i) + name[i] + name.slice(i);
};

type Entity = { idx: number; name: string; date: string; county: string; lat: number; lng: number };
const entities: Entity[] = [];
for (let i = 0; i < 140; i++) {
  const county = pick(COUNTY_NAMES);
  const [clat, clng] = CENTROIDS[county];
  entities.push({
    idx: i,
    name: `${pick(FIRST)} ${pick(MIDDLE)} ${pick(LAST)}`,
    date: isoDate(randDate()),
    county,
    lat: clat + (rng() - 0.5) * 0.1,
    lng: clng + (rng() - 0.5) * 0.1,
  });
}

const toRecord = (e: Entity, listTag: string, source: string, mutate: boolean): ERRecord => {
  const dateJitter = mutate ? Math.floor(rng() * 5) - 2 : 0;
  const nameMutated = mutate && rng() < 0.7 ? typo(e.name) : e.name;
  const dropName = mutate && rng() < 0.08;
  return {
    id: `${listTag}-E${e.idx}`,
    date: shiftDays(e.date, dateJitter),
    name: dropName ? undefined : nameMutated,
    county: mutate && rng() < 0.1 ? undefined : e.county,
    lat: e.lat + (mutate ? (rng() - 0.5) * 0.04 : 0),
    lng: e.lng + (mutate ? (rng() - 0.5) * 0.04 : 0),
    source,
  };
};

// list A = entities 0..99 (source: Missing Voices), list B = entities 40..129 (source: Police OB)
// true overlap = entities 40..99 (60 shared)
const listA: ERRecord[] = entities.slice(0, 100).map((e) => toRecord(e, "A", "missing_voices", false));
const listB: ERRecord[] = entities.slice(40, 130).map((e) => toRecord(e, "B", "police_ob", true));

const mr = matchRecords(listA, listB, { days: 3, km: 10, nameSimilarity: 0.85 });
const truePairs = mr.pairs.filter((p) => p.aId.slice(2) === p.bId.slice(2)).length;
const recall = truePairs / 60;
const precision = mr.pairs.length ? truePairs / mr.pairs.length : 0;

console.log(`\nmatchRecords(A=100 MV, B=90 OB, true overlap 60):`);
console.log(`  matched pairs: ${mr.pairs.length}  true matches: ${truePairs}  recall ${recall.toFixed(3)}  precision ${precision.toFixed(3)}`);
console.log(`  unmatched A: ${mr.unmatchedA.length}  unmatched B: ${mr.unmatchedB.length}`);
console.log("  example pair:");
const ex = mr.pairs[0];
if (ex) {
  const aRec = listA.find((r) => r.id === ex.aId);
  const bRec = listB.find((r) => r.id === ex.bId);
  console.log(`    A: ${ex.aId} ${aRec?.date} "${aRec?.name}"`);
  console.log(`    B: ${ex.bId} ${bRec?.date} "${bRec?.name}"`);
  console.log(`    score ${ex.score} — ${ex.reasons.join("; ")}`);
}
check("ER recall >= 0.90", recall >= 0.9, `recall ${recall.toFixed(3)} (${truePairs}/60)`);
check("ER precision >= 0.95", precision >= 0.95, `precision ${precision.toFixed(3)}`);
check(
  "unmatchedA + matched = 100",
  mr.unmatchedA.length + mr.pairs.length === 100,
  `${mr.unmatchedA.length} + ${mr.pairs.length}`
);
const mr2 = matchRecords(listA, listB, { days: 3, km: 10, nameSimilarity: 0.85 });
check("matchRecords deterministic", JSON.stringify(mr) === JSON.stringify(mr2), "identical repeat output");

// ————— 4. capture-pattern matrix —————
console.log("\ncapturePatternMatrix (3 lists, independent capture):");
const mseEntities: Entity[] = [];
for (let i = 0; i < 200; i++) {
  const county = pick(COUNTY_NAMES);
  const [clat, clng] = CENTROIDS[county];
  mseEntities.push({
    idx: i,
    name: `${pick(FIRST)} ${pick(MIDDLE)} ${pick(LAST)}`,
    date: isoDate(randDate()),
    county,
    lat: clat + (rng() - 0.5) * 0.1,
    lng: clng + (rng() - 0.5) * 0.1,
  });
}
const captureP = [0.5, 0.35, 0.25];
const listNames = ["MV", "OB", "MORT"];
const lists: ERRecord[][] = [[], [], []];
for (const e of mseEntities) {
  for (let li = 0; li < 3; li++) {
    if (rng() < captureP[li]) {
      lists[li].push(toRecord(e, `L${li}`, listNames[li].toLowerCase(), true));
    }
  }
}
// inject 6 within-list duplicates into MV (same entity, mutated copy)
for (let d = 0; d < 6; d++) {
  const src = lists[0][Math.floor(rng() * lists[0].length)];
  const dup: ERRecord = {
    ...src,
    id: `${src.id}-dup${d}`,
    date: shiftDays(src.date, Math.floor(rng() * 3) - 1),
    name: rng() < 0.8 ? typo(src.name ?? "") : src.name,
  };
  lists[0].push(dup);
}

const cpm = capturePatternMatrix(lists);
console.log(`  raw list sizes: ${lists.map((l) => l.length).join(", ")} (incl. 6 injected MV duplicates)`);
console.log(`  perList (deduplicated): ${cpm.perList.join(", ")}`);
console.log(`  captured entities: ${cpm.captured}`);
console.log(`  patterns:`);
for (const [k, v] of Object.entries(cpm.patterns)) {
  const label = k.split("+").map((i) => listNames[Number(i)]).join("+");
  console.log(`    ${label.padEnd(14)} (${k.padEnd(5)}) = ${v}`);
}
const patternSum = Object.values(cpm.patterns).reduce((s, v) => s + v, 0);
check("patterns sum == captured", patternSum === cpm.captured, `${patternSum} vs ${cpm.captured}`);
check(
  "MV dedupe collapses duplicates (perList[0] close to true captures)",
  Math.abs(cpm.perList[0] - new Set(lists[0].map((r) => r.id.replace(/-dup\d+$/, "").slice(2))).size) <= 2,
  `perList[0] = ${cpm.perList[0]}`
);
check(
  "captured below population (missed entities exist)",
  cpm.captured < 200 && cpm.captured > 120,
  `captured ${cpm.captured} of 200`
);

// ————— verdict —————
console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
  console.log("=".repeat(72));
  process.exit(0);
} else {
  console.log(`${failures} CHECK(S) FAILED`);
  console.log("=".repeat(72));
  process.exit(1);
}
