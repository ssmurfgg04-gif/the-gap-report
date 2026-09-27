#!/usr/bin/env node
/**
 * KAMPS Missing Voices refresh: the tier-1 civil-society series, weekly.
 *
 * missingvoices.or.ke (Police Reforms Working Group Kenya) publishes rolling
 * monthly Enforced Disappearance / Killings / Incidents statistics as
 * Highcharts configs embedded in data-chart attributes on /statistics, and
 * the most recent victim records in paginated tables on /voices.
 *
 * This script re-pulls both and UPDATES data/missing-voices.json in place,
 * preserving the exact shape the engine reads:
 *   statistics: yearly_case_totals + prosecution_statement entries are kept;
 *               monthly_series entries get their recent months overlaid with
 *               fresh site values (historical months stay frozen)
 *   victims:    replaced with the newest ~210 scraped records
 *
 * Failures degrade honestly: if a fetch fails, the previous data is kept and
 * a coverage note records what happened.
 *
 * Usage: node scripts/ingest-missingvoices.mjs
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "missing-voices.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function get(url, timeout = 30000) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(timeout) });
  return { status: r.status, text: await r.text() };
}
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
}
function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

// ————— 1. statistics: rolling monthly chart points —————
async function fetchMonthlyPoints() {
  const { status, text } = await get("https://missingvoices.or.ke/statistics");
  if (status !== 200) throw new Error(`statistics page HTTP ${status}`);
  const attrs = text.match(/data-chart="([^"]+)"/g) ?? [];
  const charts = attrs
    .map((a) => decodeEntities(a.replace(/^data-chart="|"$/g, "")))
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);
  if (charts.length === 0) throw new Error("no data-chart configs found on /statistics");

  const fresh = new Map(); // "YYYY-MM" -> { ed, killings, incidents }
  for (const c of charts) {
    const cats = c?.xAxis?.[0]?.categories ?? c?.xAxis?.categories ?? [];
    if (!Array.isArray(cats) || cats.length === 0) continue;
    if (cats.every((x) => /^\d{4}$/.test(String(x)))) continue; // yearly chart, not monthly
    const byName = {};
    for (const s of c?.series ?? []) byName[String(s?.name ?? "").toLowerCase()] = s?.data ?? [];
    if (!byName["enforced disappearances"] && !byName["killings"] && !byName["incidents"]) continue;
    cats.forEach((cat, i) => {
      const m = String(cat).match(/^([A-Za-z]+)\s+(\d{4})$/);
      if (!m) return;
      const mi = MONTHS.findIndex((x) => x.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
      if (mi < 0) return;
      const key = `${m[2]}-${String(mi + 1).padStart(2, "0")}`;
      const num = (arr) => (typeof arr?.[i] === "number" ? arr[i] : 0);
      const prev = fresh.get(key) ?? { ed: 0, killings: 0, incidents: 0 };
      fresh.set(key, {
        ed: Math.max(prev.ed, num(byName["enforced disappearances"])),
        killings: Math.max(prev.killings, num(byName["killings"])),
        incidents: Math.max(prev.incidents, num(byName["incidents"])),
      });
    });
  }
  if (fresh.size === 0) throw new Error("no monthly series found in page charts");
  return fresh;
}

// ————— 2. victims: paginated table —————
async function fetchVictims(maxRecords = 210) {
  const victims = [];
  for (let page = 0; page * 30 < maxRecords; page++) {
    const { status, text } = await get(`https://missingvoices.or.ke/voices?page=${page}`);
    if (status !== 200) break;
    const rows = text.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    let got = 0;
    for (const row of rows) {
      const cells = (row.match(/<t[d][^>]*>[\s\S]*?<\/t[d]>/g) ?? []).map((c) => stripTags(c));
      if (cells.length < 7) continue;
      const no = Number(cells[0]);
      if (!Number.isFinite(no) || no === 0) continue; // header
      const dt = (row.match(/datetime="([^"]+)"/) ?? [])[1] ?? null;
      let date = dt ? dt.slice(0, 10) : null;
      const dateDisplay = cells[6] ?? null;
      if (!date) {
        const p = String(dateDisplay).match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
        if (p) {
          const mi = MONTHS.findIndex((m) => m.toLowerCase().startsWith(p[2].toLowerCase().slice(0, 3)));
          if (mi >= 0) date = `${p[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(p[1])).padStart(2, "0")}`;
        }
      }
      victims.push({
        no, name: cells[1] || "Unknown",
        age: cells[2] ? (Number(cells[2]) || null) : null,
        sex: cells[3] || null,
        location: cells[4] || null,
        mannerOfDeath: cells[5] || null,
        date, dateDisplay,
        sourceUrl: "https://missingvoices.or.ke/voices",
      });
      got++;
    }
    if (got === 0) break;
    await sleep(1500);
  }
  return victims;
}

// ————— 3. merge into the existing file shape —————
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const coverage_notes = [];

let fresh = null;
try {
  fresh = await fetchMonthlyPoints();
  console.log(`statistics: ${fresh.size} months on the live page (latest ${[...fresh.keys()].sort().at(-1)})`);
} catch (e) {
  coverage_notes.push(`statistics refresh failed this run: ${e.message}`);
  console.log(`statistics failed (${e.message}); keeping previous series`);
}

let victims = null;
try {
  victims = await fetchVictims();
  console.log(`victims: ${victims.length} records scraped`);
} catch (e) {
  coverage_notes.push(`victims refresh failed this run: ${e.message}`);
  console.log(`victims failed (${e.message}); keeping previous records`);
}

const base = previous ?? { statistics: [], victims: [], coverage_notes: [] };
const statistics = (base.statistics ?? []).map((s) => ({ ...s })); // deep-ish copy of entries

if (fresh) {
  for (const s of statistics) {
    if (s.type !== "monthly_series" || !s.year || !Array.isArray(s.months)) continue;
    const rebuilt = { ed: [], killings: [], incidents: [] };
    s.months.forEach((m, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const key = `${s.year}-${mm}`;
      const f = fresh.get(key);
      const ed = s.enforcedDisappearanceCases?.[i] ?? null;
      const kil = s.killingCases?.[i] ?? null;
      const inc = s.incidentCases?.[i] ?? null;
      // site convention: null = no cases recorded that month
      rebuilt.ed.push(f ? f.ed : ed);
      rebuilt.killings.push(f ? f.killings : kil);
      rebuilt.incidents.push(f ? f.incidents : inc);
    });
    s.enforcedDisappearanceCases = rebuilt.ed;
    s.killingCases = rebuilt.killings;
    s.incidentCases = rebuilt.incidents;
  }
  // months belonging to a year with no entry yet: create it
  const years = new Set(statistics.filter((s) => s.type === "monthly_series").map((s) => s.year));
  for (const [key, v] of [...fresh.entries()].sort()) {
    const year = key.slice(0, 4);
    if (years.has(year)) continue;
    let entry = statistics.find((s) => s.type === "monthly_series" && s.year === year);
    if (!entry) {
      entry = {
        type: "monthly_series", year,
        months: [], enforcedDisappearanceCases: [], killingCases: [], incidentCases: [],
        note: "Chart series embedded in page (Drupal Charts/Highcharts); null = no cases recorded that month.",
        sourceUrl: "https://missingvoices.or.ke/statistics",
      };
      statistics.push(entry);
      years.add(year);
    }
    const mi = Number(key.slice(5, 7)) - 1;
    entry.months.push(`${MONTHS[mi]} ${year}`);
    entry.enforcedDisappearanceCases.push(v.ed);
    entry.killingCases.push(v.killings);
    entry.incidentCases.push(v.incidents);
  }
}

const out = {
  source: base.source ?? "Missing Voices (Police Reforms Working Group Kenya), https://missingvoices.or.ke",
  site: base.site ?? {},
  retrieved_at: new Date().toISOString(),
  statistics,
  victims: victims ?? base.victims ?? [],
  coverage_notes: [
    "Automated weekly refresh (scripts/ingest-missingvoices.mjs): rolling monthly series overlaid from the live /statistics charts; historical months frozen as first scraped; victims list re-pulled (newest ~210).",
    ...coverage_notes,
  ],
};

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote data/missing-voices.json: ${statistics.length} statistics entries, ${out.victims.length} victims.`);
