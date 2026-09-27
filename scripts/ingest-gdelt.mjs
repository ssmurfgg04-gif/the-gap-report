#!/usr/bin/env node
/**
 * KAMPS GDELT ingest: national media-attention volume, free and keyless.
 *
 * GDELT DOC 2.0 API (api.gdeltproject.org) indexes global news coverage every
 * 15 minutes. We pull the raw article-count timeline for Kenya abduction
 * coverage (mode=TimelineVolRaw, timespan=12M) and store it as a
 * corroborating signal. It measures MEDIA ATTENTION, not incidence: press
 * freedom, news cycles and language bias all shape it. The engine therefore
 * reports it next to the civil-society and conflict-coded counts, never
 * inside the risk index.
 *
 * Rate limits: the DOC API allows one request every 5 seconds and throttles
 * shared datacenter IPs aggressively. Strategy: try the broad query, fall
 * back to the simpler known-good query, and if both fail, keep the previous
 * successful timeline (marked with the attempt time) so the weekly pipeline
 * never loses its last good data.
 *
 * Usage: node scripts/ingest-gdelt.mjs
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "gdelt-kenya.json");

const QUERIES = [
  { id: "broad", q: 'kenya (abduction OR abducted OR kidnapped OR "enforced disappearance") sourcelang:eng' },
  { id: "simple", q: "abduction kenya sourcelang:eng" },
];
const SPAN = "12M";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTimeline(query) {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
    encodeURIComponent(query) + `&mode=TimelineVolRaw&timespan=${SPAN}&format=json`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "KAMPS-weekly-ingest/1.0 (research; contact via repo)" },
        signal: AbortSignal.timeout(45000),
      });
      const text = await r.text();
      if (r.status === 200 && text.trim().startsWith("{")) {
        const j = JSON.parse(text);
        if (Array.isArray(j.timeline) && j.timeline.length > 0) return j;
        return { timeline: [], empty: true };
      }
      console.log(`gdelt ${query.slice(0, 40)}...: attempt ${attempt + 1} HTTP ${r.status} (${text.slice(0, 80).replace(/\s+/g, " ")})`);
    } catch (e) {
      console.log(`gdelt: attempt ${attempt + 1} failed (${e.message})`);
    }
    await sleep(attempt === 0 ? 15000 : 40000);
  }
  return null;
}

// dates arrive as "20251003T000000Z"
function parsePoint(p) {
  const m = /^(\d{4})(\d{2})(\d{2})T/.exec(String(p?.date ?? ""));
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, volume: Math.round(Number(p?.value) || 0) };
}

let data = null;
let usedQuery = null;
for (const { id, q } of QUERIES) {
  const j = await fetchTimeline(q);
  if (j && !j.empty) { data = j; usedQuery = q; break; }
  if (j?.empty) console.log(`gdelt ${id}: 200 but empty timeline, trying next query`);
  await sleep(10000);
}

if (!data) {
  // keep the last good timeline if we have one
  if (existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, "utf8"));
      if (prev.status === "ok" && Array.isArray(prev.timeline) && prev.timeline.length > 0) {
        prev.lastAttemptAt = new Date().toISOString();
        prev.attemptNote = "This run's fetch was rate limited; the timeline below is the last successful pull.";
        writeFileSync(OUT, JSON.stringify(prev, null, 2));
        console.log("gdelt: kept the previous successful timeline (this run was throttled).");
        process.exit(0);
      }
    } catch { /* fall through to failure record */ }
  }
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    status: "failed",
    reason: "GDELT DOC API unreachable this run (rate limited). The API allows one request per 5 seconds; retry next scheduled run.",
    query: QUERIES[0].q,
    timeline: [],
    monthly: [],
  }, null, 2));
  console.log("gdelt: failed this run (recorded honestly); pipeline continues.");
  process.exit(0);
}

const series = data.timeline[0];
const timeline = (series?.data ?? [])
  .map(parsePoint)
  .filter(Boolean)
  .sort((a, b) => a.date.localeCompare(b.date));

const monthlyMap = new Map();
for (const p of timeline) {
  const m = p.date.slice(0, 7);
  monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + p.volume);
}
const monthly = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, volume]) => ({ month, volume }));

writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: "ok",
  query: usedQuery,
  endpoint: "https://api.gdeltproject.org/api/v2/doc/doc (mode=TimelineVolRaw)",
  series: series?.series ?? "Article Count",
  timeline,
  monthly,
}, null, 2));

console.log(`gdelt: ${timeline.length} daily points, ${monthly.length} months, latest ${monthly.at(-1)?.month ?? "?"} (${monthly.at(-1)?.volume ?? 0} articles).`);
