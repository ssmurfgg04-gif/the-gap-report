#!/usr/bin/env node
/**
 * KAMPS news watch: free, keyless discovery layer.
 *
 * Pulls matching coverage from two independent news search feeds and the
 * KNCHR press-statement index, then writes data/news-watch.json for the
 * engine. This is a DISCOVERY layer: articles land here so a human curator
 * can verify and promote real incidents into the curated public-record file.
 * Nothing from this file is counted as an incident.
 *
 * Feeds (all reachable without credentials or special access):
 *   1. Google News RSS  (news.google.com/rss/search)  - 3 queries, 100 items each
 *   2. Bing News RSS    (bing.com/news/search?format=RSS) - 1 query
 *   3. KNCHR /articles  (knchr.org, DNN + EasyDNNNews) - statement index with ids
 *
 * Usage: node scripts/news-watch.mjs
 * Designed to run weekly from the GitHub Action; every feed degrades
 * gracefully (a blocked feed is recorded, the run still succeeds).
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "news-watch.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ————— vocabulary —————
const MATCH_TERMS = [
  "abduct", "abduction", "abducted", "kidnap", "kidnapped", "kidnapping",
  "enforced disappearance", "disappeared", "missing", "dumped", "found alive",
  "found dead", "found safe", "tortured", "custody",
];

const GOOGLE_QUERIES = [
  { id: "g-abduction", q: "kenya abduction OR abducted OR abductions" },
  { id: "g-disappearance", q: "kenya \"enforced disappearance\" OR disappearances" },
  { id: "g-missing", q: "kenya missing activist OR blogger OR journalist OR protester" },
];
const BING_QUERY = "kenya abduction OR missing OR disappearance";

// ————— helpers —————
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}
function titleKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 90);
}
function parseRssDate(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function fetchText(url, { timeout = 30000, headers = {} } = {}) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  return { status: r.status, text: await r.text() };
}

// ————— feed 1 + 2: RSS —————
function parseRssItems(xml) {
  const out = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  for (const b of blocks) {
    const title = stripTags((b.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "");
    const link = decodeEntities(((b.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "").trim());
    const pubDate = ((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1] ?? "").trim();
    const sourceTag = stripTags((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) ?? [])[1] ?? "");
    if (!title || !link) continue;
    // Google News titles end with " - Publisher"; split for a clean title + source
    let cleanTitle = title;
    let source = sourceTag;
    const dash = title.lastIndexOf(" - ");
    if (!source && dash > 30) {
      source = title.slice(dash + 3).trim();
      cleanTitle = title.slice(0, dash).trim();
    }
    out.push({ title: cleanTitle, url: link, source: source || "news", pubDate: parseRssDate(pubDate) });
  }
  return out;
}

async function fetchGoogleNews() {
  const items = [];
  for (const { id, q } of GOOGLE_QUERIES) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-KE&gl=KE&ceid=KE:en`;
    try {
      const { status, text } = await fetchText(url);
      if (status !== 200) { console.log(`google news ${id}: HTTP ${status}, skipped`); continue; }
      const got = parseRssItems(text);
      got.forEach((g) => (g.feed = `google-news:${id}`));
      items.push(...got);
      console.log(`google news ${id}: ${got.length} items`);
    } catch (e) {
      console.log(`google news ${id}: failed (${e.message}), skipped`);
    }
    await sleep(1500);
  }
  return items;
}

async function fetchBingNews() {
  try {
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(BING_QUERY)}&format=RSS`;
    const { status, text } = await fetchText(url);
    if (status !== 200) { console.log(`bing news: HTTP ${status}, skipped`); return []; }
    const got = parseRssItems(text).map((g) => ({ ...g, feed: "bing-news" }));
    console.log(`bing news: ${got.length} items`);
    return got;
  } catch (e) {
    console.log(`bing news: failed (${e.message}), skipped`);
    return [];
  }
}

// ————— feed 3: KNCHR statement index —————
async function fetchKnchr() {
  try {
    const { status, text } = await fetchText("https://www.knchr.org/articles", { timeout: 40000 });
    if (status !== 200) { console.log(`knchr: HTTP ${status}, keeping previous index`); return { failed: true }; }
    const re = /<a[^>]+href="[^"]*articleid=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const seen = new Map();
    let m;
    while ((m = re.exec(text)) !== null) {
      const title = stripTags(m[2]);
      if (title && !seen.has(m[1])) seen.set(m[1], title);
    }
    const statements = [...seen.entries()]
      .map(([id, title]) => ({ id: Number(id), title, url: `https://www.knchr.org/articles` }))
      .sort((a, b) => b.id - a.id)
      .slice(0, 10);
    console.log(`knchr: ${statements.length} statements, latest id ${statements[0]?.id ?? "?"}`);
    return { latestId: statements[0]?.id ?? null, statements };
  } catch (e) {
    console.log(`knchr: failed (${e.message}), keeping previous index`);
    return { failed: true };
  }
}

// ————— assemble —————
const [gItems, bItems, knchr] = await Promise.all([fetchGoogleNews(), fetchBingNews(), fetchKnchr()]);

const today = new Date().toISOString().slice(0, 10);
const byKey = new Map();
for (const it of [...gItems, ...bItems]) {
  // keep only articles from the trailing 60 days (RSS can return old items)
  if (it.pubDate && it.pubDate < new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)) continue;
  const matched = MATCH_TERMS.filter((t) => `${it.title} ${it.source}`.toLowerCase().includes(t));
  if (matched.length === 0) continue;
  const key = titleKey(it.title);
  if (!key || byKey.has(key)) continue;
  byKey.set(key, {
    title: it.title, url: it.url, source: it.source,
    pubDate: it.pubDate ?? today, matchedTerms: matched, feed: it.feed,
  });
}
const articles = [...byKey.values()].sort((a, b) => b.pubDate.localeCompare(a.pubDate)).slice(0, 200);

// daily counts for the trailing 45 days (for 7-day vs baseline spike logic)
const daily = [];
for (let i = 44; i >= 0; i--) {
  const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  daily.push({ date: d, count: articles.filter((a) => a.pubDate === d).length });
}

// previous run: flag KNCHR statements that are new since last ingest; a
// failed KNCHR fetch keeps the previous index instead of nulling it
let prevKnchrId = null;
let prevKnchr = null;
if (existsSync(OUT)) {
  try {
    const prev = JSON.parse(readFileSync(OUT, "utf8"));
    prevKnchrId = prev.knchr?.latestId ?? null;
    prevKnchr = prev.knchr ?? null;
  } catch { /* fresh */ }
}
if (knchr.failed) {
  if (prevKnchr) {
    Object.assign(knchr, prevKnchr, { note: "KNCHR fetch failed this run; the previous index is preserved." });
    console.log("knchr: previous index preserved.");
  } else {
    knchr.latestId = null;
    knchr.statements = [];
  }
}
if (knchr.latestId && prevKnchrId && knchr.latestId > prevKnchrId) {
  console.log(`KNCHR: ${knchr.latestId - prevKnchrId} new statement(s) since last run (ids ${prevKnchrId + 1}..${knchr.latestId}) - flagged for curation`);
  knchr.newSinceLastRun = knchr.latestId - prevKnchrId;
}
knchr.prevLatestId = prevKnchrId;

const out = {
  generatedAt: new Date().toISOString(),
  feeds: ["Google News RSS (3 queries)", "Bing News RSS", "KNCHR article index"],
  queries: GOOGLE_QUERIES.map((g) => g.q).concat([BING_QUERY]),
  note:
    "Discovery layer only: keyword-matched news coverage and the KNCHR statement index. " +
    "No row in here counts as an incident; humans verify and promote documented cases " +
    "into incidents-public-record.json with a fetched source URL.",
  articles,
  daily,
  knchr,
};

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote data/news-watch.json: ${articles.length} articles, ${daily.slice(-7).reduce((s, d) => s + d.count, 0)} in the last 7 days.`);
