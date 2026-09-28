#!/usr/bin/env node
/**
 * KAMPS curation queue watcher.
 *
 * The weekly digest files candidate articles from the discovery layer
 * (news watch). Until now that queue was ephemeral: it lived only in the
 * issue body, with no memory between weeks, no corroboration tracking and
 * no promotion path into the documented record.
 *
 * This script makes the queue a first-class, persistent object:
 *
 *   sweep (default)  reads data/news-watch.json, classifies leads, clusters
 *                    articles that describe the same incident, counts the
 *                    INDEPENDENT outlets covering each case, cross-matches
 *                    against the documented record (duplicates never
 *                    re-enter), and writes data/curation-queue.json.
 *
 *                    A case with 2+ independent outlets is flagged "ready":
 *                    one human verification away from entering the
 *                    documented count.
 *
 *   --promote ID     appends a verified case into
 *                    data/incidents-public-record.json (with source URLs),
 *                    marks it promoted, syncs count + manifest.
 *   --reject ID     marks a case rejected with a reason.
 *   --status        prints the queue table.
 *
 * Runs weekly inside .github/workflows/weekly-ingest.yml right after the
 * news watch sweep, before the digest is generated.
 *
 * Usage:
 *   node scripts/curation-queue.mjs
 *   node scripts/curation-queue.mjs --promote otieno-2026-09-26 \
 *        --person "Collins Otieno" --date 2026-09-26 \
 *        --location "Nairobi (Thika Road)" --status returned \
 *        --source-url https://... --source-name "Tuko News" \
 *        --curator "operator" --notes "..."
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NW = path.join(ROOT, "data", "news-watch.json");
const RECORD = path.join(ROOT, "data", "incidents-public-record.json");
const STATE = path.join(ROOT, "data", "curation-queue.json");
const MANIFEST = path.join(ROOT, "data", "manifest.json");

const readJson = (p, fallback) => {
  if (!existsSync(p)) return fallback;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};

// ————————————————————————————————— argument parsing —————————————————————————————————
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const mode = argv.includes("--promote") ? "promote"
  : argv.includes("--reject") ? "reject"
  : argv.includes("--status") ? "status"
  : "sweep";

// ————————————————————————————————— text utilities —————————————————————————————————
const STOP = new Set((
  "a an the and or of in on at to for from with without after before found dumped along rushed " +
  "hospital missing another cant speak weak injured photos emerge kenya kenyan abductions tech " +
  "firm launches emergency qr code curb rising child powerful legal shields citizens courts use " +
  "expert activist activists protester protesters human rights editor editors standard group safe " +
  "truck turnboy shot dead following abduction abducted kidnap kidnapped disappear disappeared " +
  "missing man woman student person people two three five days year years photos says say said amid " +
  "fears fear new news kenya's must not law eroding democracy condemns condemned statement urges " +
  "urge report reports reported live alive update update's police officers officers' ipoa knchr " +
  "rights now press association ifj fip international federation journalists journalist " +
  "yet again more over into out up down off vs by as is are was were be been his her their its " +
  "he she they it who whom whose which what when where why how " +
  // person-extraction hygiene: orgs, places, politicians, reportage verbs
  "amnesty odm bake ipi icj africa ghana sudan ethiopia somalia uganda tanzania mandera nairobi " +
  "thika lukenya machakos kisumu mombasa nakuru eldoret president william ruto gachagua odinga " +
  "raila maanzo reportedly allegedly employer spokesperson freed intervenes elders herders masked " +
  "gunmen armed twice ordeal accuses branded branded's ordem ordinary"
).split(/\s+/));

/** tokens too generic to link two articles (function words + coverage verbs) */
const LINK_STOP = new Set((
  "a an the and or of in on at to for from with after before found safe says say said kenya " +
  "kenyan kenya's following following's amid new update live alive weak injured photos emerge " +
  "again more over into out up down off vs by as is are was were be been his her their its he " +
  "she they it who whose which what when where why how another missing"
).split(/\s+/));

const stem = (t) => t.replace(/(ed|es|s|ion|ing)$/, "");

const tokens = (s) => (s ?? "")
  .replace(/[^A-Za-z' ]+/g, " ").split(/\s+/)
  .filter(Boolean);

const nameish = (s) => (s ?? "")
  .replace(/[^A-Za-z' ]+/g, " ").split(/\s+/)
  .filter(Boolean);

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
};

/** Extract a likely person name from a headline: runs of >=2 capitalized
 *  tokens that are not stopwords, scored by adjacency to person-context. */
const CONTEXT = /missing|abduct|kidnap|found|dumped|activist|protester|editor/i;
function extractPerson(title) {
  const words = nameish(title);
  const isCap = (w) => /^[A-Z][a-z']+$/.test(w);
  let best = null, bestScore = 0;
  for (let i = 0; i < words.length; i++) {
    if (!isCap(words[i]) || STOP.has(words[i].toLowerCase())) continue;
    let j = i;
    while (j + 1 < words.length && isCap(words[j + 1]) && !STOP.has(words[j + 1].toLowerCase())) j++;
    if (j === i) continue; // need >=2 tokens
    const name = words.slice(i, j + 1).join(" ");
    if (j - i > 2) j = i + 2; // cap at 3 tokens for scoring window
    let score = j - i + 1;
    const before = words[Math.max(0, i - 1)];
    const after = words[Math.min(words.length - 1, j + 1)];
    if (before && CONTEXT.test(before)) score += 2;
    if (after && /found|dumped|was|is|after|before/i.test(after)) score += 1;
    if (score > bestScore) { bestScore = score; best = name; }
    i = j;
  }
  return best;
}

const bigrams = (s) => {
  const t = tokens(s.toLowerCase()).filter(w => !LINK_STOP.has(w));
  const out = new Set();
  for (let i = 0; i + 1 < t.length; i++) out.add(`${t[i]} ${t[i + 1]}`);
  return out;
};
const cosine = (a, b) => {
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / Math.sqrt(a.size * b.size || 1);
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ————————————————————————————————— classification —————————————————————————————————
// advocacy, reaction, statistics and profile coverage: about the phenomenon,
// not a specific new incident. These never enter the queue.
const NON_LEAD = /launches|qr code|expert|legal shields|eroding|democracy|law must|analysis|\bopinion\b|editorial|condemns|urges|urged|statement on|report:|calls on|calls for|demands? (?:action|end|answers)|slams|warns|brands|raises alarm|push for|must (?:end|stop|act|protect)|challenges .* to act|asks .* to act|worst for|best for|under scrutiny|centre of|account for|compensation|recorded in|records \d+|cases (?:emerge|recorded)|how .* rose|alleged .* network|victims of enforced|marks|anniversary|tribute|funeral of|mourns|burial|into action|ballot|weapon|goonism|summoned|rights groups|once again|concerns grow|casting a shadow|shadow over|spike|surge in/i;
const OUT_OF_SCOPE = /\bin (ethiopia|south sudan|sudan|somalia|uganda|tanzania|drc|congo|south africa|nigeria|malawi|zambia)\b/i;
const LEAD = /abduct|kidnap|disappear|missing|dumped|found (?:alive|safe|dead|dumped)/i;

function classify(title) {
  if (OUT_OF_SCOPE.test(title)) return { lead: false, reason: "out_of_scope" };
  if (NON_LEAD.test(title)) return { lead: false, reason: "analysis_or_advocacy" };
  if (!LEAD.test(title)) return { lead: false, reason: "no_incident_signal" };
  return { lead: true, reason: "" };
}

// strip the trailing " - <outlet>" suffix news feeds append before tokenizing
const stripSuffix = (title) => title.replace(/\s+[-–—]\s+[^-–—]{2,40}$/, "").trim();

// ————————————————————————————————— load inputs —————————————————————————————————
const nw = readJson(NW, { articles: [] });
const record = readJson(RECORD, { incidents: [] });
const state = readJson(STATE, { queue: {} });
const prevQueue = state.queue ?? {};

const articles = (nw.articles ?? [])
  .filter(a => a.title && a.url)
  .filter(a => a.pubDate >= new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10));

// ————————————————————————————————— clustering (union-find) —————————————————————————————————
const leads = [];
for (const a of articles) {
  const c = classify(a.title);
  if (!c.lead) continue;
  const core = stripSuffix(a.title);
  leads.push({ ...a, core, person: extractPerson(core), reason: c.reason });
}
const parent = leads.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

for (let i = 0; i < leads.length; i++) {
  for (let j = i + 1; j < leads.length; j++) {
    const A = leads[i], B = leads[j];
    const dayGap = Math.abs(new Date(A.pubDate) - new Date(B.pubDate)) / 86400000;
    if (dayGap > 3) continue;
    const samePerson = A.person && B.person && jaccard(
      tokens(A.person.toLowerCase()), tokens(B.person.toLowerCase())) >= 0.5;
    const titleSim = cosine(bigrams(A.core), bigrams(B.core));
    // shared distinctive stems. Domain words (activist, dumped, abduct ...) count
    // toward the total but can NEVER be the only link: two titles sharing only
    // "activist"+"dumped" are two different cases in this beat.
    const DOMAIN = new Set(["activist", "protester", "dump", "abduct", "kidnap",
      "miss", "editor", "journalist", "victim", "dead", "alive", "safe",
      "hospital", "injur", "weak", "right", "human", "police", "govern"]);
    const Aset = new Set(tokens(A.core.toLowerCase()).filter(w => w.length >= 4 && !LINK_STOP.has(w)).map(stem));
    const Bset = new Set(tokens(B.core.toLowerCase()).filter(w => w.length >= 4 && !LINK_STOP.has(w)).map(stem));
    let shared = 0, sharedDistinct = 0;
    for (const s of Aset) if (Bset.has(s)) {
      shared++;
      if (!DOMAIN.has(s)) sharedDistinct++;
    }
    if (samePerson || titleSim >= 0.42 || shared >= 3 || (shared >= 2 && sharedDistinct >= 1)) union(i, j);
  }
}

// ————————————————————————————————— case assembly —————————————————————————————————
const groups = new Map();
leads.forEach((a, i) => {
  const r = find(i);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(a);
});

// record cross-match: a case already in the documented record never re-enters.
// Rule 1 (strong): the cluster's extracted person matches a documented person
// within 45 days. Rule 2 (role + tight window): unnamed-role coverage like
// "Kenyan editor found safe after abduction" matches a documented person whose
// record carries the same role noun, within 14 days. Generic shared-token
// matching was tried and false-positives on shared newsmakers (Ruto, police),
// so it is deliberately NOT used.
const ROLE_WORDS = /editor|journalist|activist|protester|student|lawyer|lecturer|doctor|herder|driver|turnboy|boda/i;
function matchRecord(person, coreTitles, date) {
  const blob = coreTitles.join(" ").toLowerCase();
  const titleRoles = blob.match(ROLE_WORDS) ?? [];
  const incidentWord = /abduct|disappear|missing|found|dumped/.test(blob);
  for (const r of record.incidents ?? []) {
    if (!r.date || !date) continue;
    const dayGap = Math.abs(new Date(r.date) - new Date(date)) / 86400000;
    if (dayGap > 45) continue;
    const rp = tokens((r.person ?? "").toLowerCase());
    if (person && rp.length && jaccard(tokens(person.toLowerCase()), rp) >= 0.5) {
      return { recordId: r.id ?? r.person, person: r.person };
    }
    if (dayGap <= 14 && titleRoles.length && incidentWord) {
      const recBlob = ((r.person ?? "") + " " + (r.location ?? "") + " " + (r.notes ?? "")).toLowerCase();
      for (const role of titleRoles) {
        if (recBlob.includes(role)) return { recordId: r.id ?? r.person, person: r.person, role };
      }
    }
  }
  return null;
}

const today = new Date().toISOString().slice(0, 10);
const queue = {};
for (const g of groups.values()) {
  const sorted = [...g].sort((a, b) => a.pubDate.localeCompare(b.pubDate));
  const rep = sorted.find(a => a.person) ?? sorted[0];
  const person = rep.person;
  const outlets = [...new Set(sorted.map(a => a.source))];
  const urls = sorted.map(a => a.url);
  const caseId = (person ? slug(person) : "case-" + slug(sorted[0].core).slice(0, 40)) + "-" + sorted[0].pubDate;
  const prevCase = prevQueue[caseId];
  const dup = matchRecord(person, sorted.map(a => a.core), sorted[0].pubDate);
  const freshCorrob = outlets.length;
  // Terminal cases (promoted/rejected) are human-verified: keep the verified
  // fields (person, outlets, corroboration, URLs) from the previous sweep
  // instead of rebuilding them from feed hints. The feed cannot re-verify an
  // already-promoted case, and rebuilding would clobber e.g. the HTTP-200
  // corroboration trail with Google News redirect links.
  if (prevCase && ["promoted", "rejected"].includes(prevCase.status)) {
    queue[caseId] = { ...prevCase, lastSeen: today, latestPubDate: sorted.at(-1).pubDate };
    continue;
  }
  queue[caseId] = {
    caseId,
    person: person ?? null,
    incidentHint: rep.core,
    firstSeen: prevCase?.firstSeen ?? today,
    lastSeen: today,
    pubDate: sorted[0].pubDate,
    latestPubDate: sorted.at(-1).pubDate,
    outlets,
    corroboration: freshCorrob,
    urls,
    articles: sorted.map(a => ({ title: a.title, source: a.source, pubDate: a.pubDate, url: a.url })),
    status: ["promoted", "rejected"].includes(prevCase?.status)
      ? prevCase.status
      : dup ? "duplicate" : freshCorrob >= 2 ? "ready" : "pending",
    duplicateOf: dup ? `${dup.person} (${dup.recordId})` : prevCase?.duplicateOf ?? null,
    promotedAt: prevCase?.promotedAt ?? null,
    promotedRecordId: prevCase?.promotedRecordId ?? null,
    rejectedReason: prevCase?.rejectedReason ?? null,
  };
}

// preserve terminal decisions for cases no longer surfacing in the feeds (60d memory)
for (const [id, c] of Object.entries(prevQueue)) {
  if (!queue[id] && ["promoted", "rejected"].includes(c.status)) queue[id] = { ...c, lastSeen: today };
}

const rejectedLeads = articles
  .filter(a => classify(a.title).reason === "out_of_scope")
  .map(a => `[out_of_scope] ${a.title} (${a.source}, ${a.pubDate})`);

// ————————————————————————————————— modes —————————————————————————————————
if (mode === "status") {
  const rows = Object.values(queue).sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  console.log("caseId".padEnd(38) + "status".padEnd(11) + "corr".padEnd(5) + "person / hint");
  for (const r of rows) {
    console.log(
      r.caseId.padEnd(38) + r.status.padEnd(11) + String(r.corroboration).padEnd(5) +
      (r.person ?? r.incidentHint.slice(0, 60)) +
      (r.duplicateOf ? `  [dup of ${r.duplicateOf}]` : "")
    );
  }
  const by = (s) => Object.values(queue).filter(c => c.status === s).length;
  console.log(`\ntotals: ${by("ready")} ready (one verification away), ${by("pending")} pending, ` +
    `${by("duplicate")} duplicate, ${by("promoted")} promoted, ${by("rejected")} rejected`);
  process.exit(0);
}

if (mode === "reject") {
  const id = argv[argv.indexOf("--reject") + 1];
  if (!queue[id]) { console.error(`no such case: ${id}`); process.exit(1); }
  queue[id].status = "rejected";
  queue[id].rejectedReason = arg("reason") ?? "rejected by curator";
  writeFileSync(STATE, JSON.stringify({ generatedAt: new Date().toISOString(), queue }, null, 2));
  console.log(`rejected: ${id} (${queue[id].rejectedReason})`);
  process.exit(0);
}

if (mode === "promote") {
  const id = argv[argv.indexOf("--promote") + 1];
  const c = queue[id];
  if (!c) { console.error(`no such case: ${id}`); process.exit(1); }
  if (c.status === "promoted") { console.error(`already promoted: ${id}`); process.exit(1); }
  const corroborating = arg("corroborating")
    ? arg("corroborating").split(";").map(s => s.trim()).filter(Boolean)
    : c.urls;
  const entry = {
    id: (arg("record-id") ?? id).replace(/[^a-z0-9-]/gi, "").toLowerCase(),
    date: arg("date") ?? c.pubDate,
    datePrecision: arg("precision") ?? "day",
    person: arg("person") ?? c.person ?? "Unknown",
    location: arg("location") ?? null,
    status: arg("status") ?? "returned",
    category: arg("category") ?? "abduction",
    sourceName: arg("source-name") ?? c.outlets[0],
    sourceUrl: arg("source-url") ?? c.urls[0],
    notes:
      `Verified via cross-source corroboration: ${c.corroboration}+ independent outlets ` +
      `(${c.outlets.join(", ")}). Promoted from the curation queue on ${today} by ` +
      `${arg("curator") ?? "curator"}. Corroborating coverage: ` +
      corroborating.join(" ; ") + (arg("notes") ? ` ${arg("notes")}` : ""),
  };
  record.incidents.push(entry);
  record.incidents.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  record.count = record.incidents.length;
  record.compiled_at = new Date().toISOString();
  if (!(record.sources ?? []).includes(entry.sourceUrl)) record.sources.push(entry.sourceUrl);
  writeFileSync(RECORD, JSON.stringify(record, null, 2));

  c.status = "promoted";
  c.promotedAt = new Date().toISOString();
  c.promotedRecordId = entry.id;
  writeFileSync(STATE, JSON.stringify({ generatedAt: new Date().toISOString(), queue }, null, 2));

  const manifest = readJson(MANIFEST, null);
  if (manifest) {
    for (const f of manifest.files ?? []) {
      if (f.file === "incidents-public-record.json") {
        f.rows_or_features = `${record.count} incidents (${(record.incidents ?? []).length} rows; queue promotions appended with corroboration trail)`;
        f.retrieved_at = record.compiled_at;
      }
    }
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }
  console.log(`promoted ${id} -> incidents-public-record.json (record now ${record.count} rows)`);
  process.exit(0);
}

// ————————————————————————————————— sweep output —————————————————————————————————
writeFileSync(STATE, JSON.stringify({
  generatedAt: new Date().toISOString(),
  watchWindowDays: 60,
  note:
    "Persistent curation state for the weekly digest's curator queue. A case with " +
    "corroboration >= 2 independent outlets is 'ready': one human verification away from " +
    "entering the documented count. Promotion (curation-queue.mjs --promote) writes the " +
    "verified case into incidents-public-record.json with its corroborating source URLs.",
  queue,
}, null, 2));

const by = (s) => Object.values(queue).filter(c => c.status === s).length;
const ready = Object.values(queue).filter(c => c.status === "ready");
console.log(`curation queue: ${Object.keys(queue).length} cases tracked`);
console.log(`  ready (one verification away): ${by("ready")}`);
for (const r of ready) console.log(`    - ${r.caseId} [${r.corroboration} outlets: ${r.outlets.join(", ")}]`);
console.log(`  pending single-source: ${by("pending")}`);
console.log(`  duplicate of documented record: ${by("duplicate")}`);
console.log(`  promoted: ${by("promoted")}, rejected: ${by("rejected")}`);
if (rejectedLeads.length) for (const l of rejectedLeads) console.log(`  ${l}`);
console.log(`wrote data/curation-queue.json`);
