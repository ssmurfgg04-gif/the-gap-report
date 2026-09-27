/**
 * KAMPS entity resolution (Splink-inspired, pure TypeScript).
 *
 * Deterministic pairwise matching between incident lists using
 *   - date proximity (± N days),
 *   - geo proximity (haversine distance ≤ N km),
 *   - name similarity (Jaro-Winkler ≥ threshold),
 * with a greedy one-to-one assignment scored by a weighted mix of the three
 * signals, plus a capture-pattern matrix built by deduplicating records across
 * lists with tight thresholds (union-find over matched pairs).
 *
 * O(n*m) pairwise cost is acceptable for lists under ~5000 records.
 * No dependencies, no randomness: identical inputs give identical outputs.
 */

// ———————————————————————————————————————————— types ————————————————————————————————————————————

export type ERRecord = {
  id: string;
  /** ISO date (YYYY-MM-DD or full ISO timestamp) */
  date: string;
  name?: string;
  location?: string;
  county?: string;
  lat?: number;
  lng?: number;
  source: string;
};

export type MatchThresholds = {
  /** maximum absolute date difference in days */
  days: number;
  /** maximum haversine distance in km (when both records carry coordinates) */
  km: number;
  /** minimum Jaro-Winkler name similarity (when both records carry names) */
  nameSimilarity: number;
};

export type MatchPair = {
  aId: string;
  bId: string;
  /** 0..1 weighted mix: 0.5 name + 0.3 geo + 0.2 date (+0.05 county agreement) */
  score: number;
  /** human-readable reasons the pair matched */
  reasons: string[];
};

export type MatchResult = {
  /** matched pairs, ordered by score desc then ids asc (deterministic) */
  pairs: MatchPair[];
  unmatchedA: string[];
  unmatchedB: string[];
};

export type CapturePatternMatrix = {
  /** pattern key ("0", "0+1", "0+1+2", …) -> number of distinct entities captured in exactly those lists */
  patterns: Record<string, number>;
  /** number of distinct entities after cross-list deduplication */
  captured: number;
  /** deduplicated record count per input list */
  perList: number[];
};

// ———————————————————————————————————————— primitives ————————————————————————————————————————

/** Haversine great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** Normalize a string for comparison: lowercase, collapse whitespace, drop punctuation. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaro-Winkler similarity (0..1) with prefix scaling (p = 0.1, prefix ≤ 4).
 * Inputs are normalized (case/whitespace/punctuation-insensitive) first.
 */
export function jaroWinkler(a: string, b: string): number {
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // ——— Jaro ———
  const window = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(i + window + 1, s2.length);
    for (let j = lo; j < hi; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  // transpositions: matched characters out of order
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions) / matches) / 3;

  // ——— Winkler prefix boost ———
  let prefix = 0;
  const maxPrefix = Math.min(4, s1.length, s2.length);
  while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

const DAY_MS = 86_400_000;

function parseDateMs(d: string): number {
  const t = Date.parse(d);
  return Number.isNaN(t) ? NaN : t;
}

function num(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ———————————————————————————————————————— matching ————————————————————————————————————————

type PairEvaluation = { ok: boolean; score: number; reasons: string[] };

/**
 * Evaluate one candidate pair under the given thresholds.
 *
 * Blocking rules (all must hold):
 *   - both dates parse and differ by ≤ `days`;
 *   - when both records have names, Jaro-Winkler ≥ `nameSimilarity`;
 *   - when both records have coordinates, distance ≤ `km`;
 *   - at least one of name / geo must be comparable (date alone never matches).
 *
 * Score = 0.5·name + 0.3·geo + 0.2·date (non-comparable signals contribute a
 * neutral 0.5) plus a 0.05 bonus when both counties are present and equal.
 */
function evaluatePair(a: ERRecord, b: ERRecord, t: MatchThresholds): PairEvaluation {
  const ta = parseDateMs(a.date);
  const tb = parseDateMs(b.date);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return { ok: false, score: 0, reasons: [] };
  const dd = Math.abs(ta - tb) / DAY_MS;
  if (dd > t.days) return { ok: false, score: 0, reasons: [] };
  const reasons: string[] = [`date within ${dd.toFixed(1)}d (max ${t.days}d)`];

  const nameA = a.name?.trim() ?? "";
  const nameB = b.name?.trim() ?? "";
  const namesComparable = nameA.length > 0 && nameB.length > 0;
  let nameScore = 0.5;
  if (namesComparable) {
    nameScore = jaroWinkler(nameA, nameB);
    if (nameScore < t.nameSimilarity) return { ok: false, score: 0, reasons: [] };
    reasons.push(`name JW ${nameScore.toFixed(3)} >= ${t.nameSimilarity}`);
  }

  const latA = num(a.lat);
  const lngA = num(a.lng);
  const latB = num(b.lat);
  const lngB = num(b.lng);
  const geoComparable = latA !== null && lngA !== null && latB !== null && lngB !== null;
  let geoScore = 0.5;
  if (geoComparable) {
    const dist = haversineKm(latA, lngA, latB, lngB);
    if (dist > t.km) return { ok: false, score: 0, reasons: [] };
    geoScore = Math.max(0, 1 - dist / Math.max(t.km, 0.001));
    reasons.push(`geo ${dist.toFixed(1)}km <= ${t.km}km`);
  }

  if (!namesComparable && !geoComparable) {
    return { ok: false, score: 0, reasons: [] }; // date alone is not evidence
  }

  const dateScore = Math.max(0, 1 - dd / (t.days + 1));
  let score = 0.5 * nameScore + 0.3 * geoScore + 0.2 * dateScore;
  const countyA = a.county?.trim().toLowerCase();
  const countyB = b.county?.trim().toLowerCase();
  if (countyA && countyB && countyA === countyB) {
    score = Math.min(1, score + 0.05);
    reasons.push(`county match: ${countyA}`);
  }
  if (!namesComparable) reasons.push("name not comparable (neutral)");
  if (!geoComparable) reasons.push("geo not comparable (neutral)");
  return { ok: true, score: Math.round(score * 1000) / 1000, reasons };
}

/**
 * Pairwise match two incident lists with a greedy one-to-one assignment.
 *
 * All candidate pairs are evaluated, sorted by score (desc) with deterministic
 * id tie-breaks, and assigned greedily so each record matches at most one
 * record from the other list.
 */
export function matchRecords(a: ERRecord[], b: ERRecord[], thresholds: MatchThresholds): MatchResult {
  const candidates: { aIdx: number; bIdx: number; ev: PairEvaluation }[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const ev = evaluatePair(a[i], b[j], thresholds);
      if (ev.ok) candidates.push({ aIdx: i, bIdx: j, ev });
    }
  }
  candidates.sort(
    (x, y) =>
      y.ev.score - x.ev.score ||
      a[x.aIdx].id.localeCompare(a[y.aIdx].id) ||
      b[x.bIdx].id.localeCompare(b[y.bIdx].id)
  );

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: MatchPair[] = [];
  for (const c of candidates) {
    if (usedA.has(c.aIdx) || usedB.has(c.bIdx)) continue;
    usedA.add(c.aIdx);
    usedB.add(c.bIdx);
    pairs.push({ aId: a[c.aIdx].id, bId: b[c.bIdx].id, score: c.ev.score, reasons: c.ev.reasons });
  }

  const unmatchedA = a.filter((_, i) => !usedA.has(i)).map((r) => r.id);
  const unmatchedB = b.filter((_, j) => !usedB.has(j)).map((r) => r.id);
  return { pairs, unmatchedA, unmatchedB };
}

// ————————————————————————————— capture-pattern matrix —————————————————————————————

/** Tight internal thresholds for "these two records are the same incident". */
const DEDUPE_THRESHOLDS: MatchThresholds = { days: 2, km: 5, nameSimilarity: 0.88 };

/**
 * Capture-pattern matrix for Multiple Systems Estimation input checking.
 *
 * Deduplicates records across (and within) the supplied lists by running the
 * same pairwise matcher with tight thresholds, linking matched records with
 * union-find, and counting how many distinct entities appear in exactly which
 * combinations of lists. `perList` counts deduplicated entities per list.
 */
export function capturePatternMatrix(lists: ERRecord[][]): CapturePatternMatrix {
  const entries: { record: ERRecord; listIdx: number }[] = [];
  for (let li = 0; li < lists.length; li++) {
    for (const r of lists[li]) entries.push({ record: r, listIdx: li });
  }
  const n = entries.length;
  const parent = new Array<number>(n).fill(0).map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
  };

  // pairwise linking with tight thresholds (cheap date gate first)
  for (let i = 0; i < n; i++) {
    const ti = parseDateMs(entries[i].record.date);
    if (Number.isNaN(ti)) continue;
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue;
      const tj = parseDateMs(entries[j].record.date);
      if (Number.isNaN(tj)) continue;
      if (Math.abs(ti - tj) / DAY_MS > DEDUPE_THRESHOLDS.days) continue;
      const ev = evaluatePair(entries[i].record, entries[j].record, DEDUPE_THRESHOLDS);
      if (ev.ok) union(i, j);
    }
  }

  // group entities and record which lists each appears in
  const entityLists = new Map<number, Set<number>>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    let set = entityLists.get(root);
    if (!set) {
      set = new Set<number>();
      entityLists.set(root, set);
    }
    set.add(entries[i].listIdx);
  }

  const patterns: Record<string, number> = {};
  for (const set of entityLists.values()) {
    const key = [...set].sort((x, y) => x - y).join("+");
    patterns[key] = (patterns[key] ?? 0) + 1;
  }

  // per-list entity counts (deduplicated within each list)
  const perList: number[] = new Array<number>(lists.length).fill(0);
  for (const set of entityLists.values()) {
    for (const li of set) perList[li]++;
  }

  // stable key order: by number of lists, then lexicographic
  const ordered: Record<string, number> = {};
  for (const key of Object.keys(patterns).sort((x, y) => {
    const nx = x.split("+").length;
    const ny = y.split("+").length;
    return nx - ny || x.localeCompare(y);
  })) {
    ordered[key] = patterns[key];
  }

  return { patterns: ordered, captured: entityLists.size, perList };
}
