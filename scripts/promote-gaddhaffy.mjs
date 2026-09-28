#!/usr/bin/env node
// Promote the South Sudanese whistleblower case (Athorbey Al-Gaddhaffy-Dit) into
// the documented public record, following the 2026-09-28 Mulinge/Otieno precedent.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const STATE = "data/curation-queue.json";
const CASE = "south-sudanese-2026-08-10";

// Verified via web search + HTTP-200 fetch on 2026-09-28:
const VERIFIED = [
  { url: "https://www.radiotamazuj.org/en/news/article/south-sudanese-man-abducted-in-kenya-released-after-two-months", outlet: "Radio Tamazuj", title: "South Sudanese man abducted in Kenya released after two months", date: "2026-08-10" },
  { url: "https://capitalfm.africa/south-sudan-whistleblower-athorbey-released-after-nearly-two-months-in-detention/", outlet: "Capital FM Kenya", title: "South Sudan whistleblower Athorbey released after nearly two months in detention", date: "2026-08-10" },
  { url: "https://punchng.com/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/", outlet: "Punch Newspapers", title: "South Sudan Whistleblower Abducted in Kenya Released (AFP)", date: "2026-08-10" },
  { url: "https://www.eastleighvoice.co.ke/2026/08/11/whistleblower-released-following-abduction-and-deportation-to-juba/", outlet: "The Eastleigh Voice", title: "Whistleblower released following 'abduction' and deportation to Juba", date: "2026-08-11" },
  { url: "https://bodexng.com/2026/08/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/", outlet: "BodexNG", title: "South Sudan whistleblower abducted in Kenya released after two months", date: "2026-08-10" },
  { url: "https://capitalfm.africa/rights-groups-demand-urgent-safeguards-for-businessman-reportedly-abducted-in-nairobi-and-moved-to-south-sudan/", outlet: "Capital FM Kenya", title: "Rights groups demand urgent safeguards for businessman reportedly abducted in Nairobi (June abduction report)", date: "2026-06-12" },
];

// 1. Patch the queue case with the verified corroboration set (replaces the
//    unresolvable Google News redirect links captured by the news watch).
const q = JSON.parse(readFileSync(STATE, "utf8"));
const c = q.queue[CASE];
if (!c) { console.error("case missing: " + CASE); process.exit(1); }
if (c.status === "promoted") { console.error("already promoted"); process.exit(1); }
c.person = "Athorbey Al-Gaddhaffy-Dit";
c.incidentHint = "South Sudanese graft whistleblower abducted in Nairobi, deported to Juba, released after two months";
c.outlets = [...new Set(VERIFIED.map(v => v.outlet))];
c.corroboration = c.outlets.length;
c.urls = VERIFIED.map(v => v.url);
c.articles = VERIFIED.map(v => ({ title: v.title, source: v.outlet, pubDate: v.date, url: v.url }));
writeFileSync(STATE, JSON.stringify(q, null, 2));
console.log(`queue case patched: ${CASE} -> ${c.corroboration} verified outlets`);

// 2. Promote into the public record.
const notes =
  "South Sudanese graft whistleblower and Nairobi businessman Athorbey Al-Gaddhaffy-Dit " +
  "(full name Athorbey Al-Gaddhaffy-Dit Guet, also known as Gaddafi; styled Gaddhaffy Athorbey by " +
  "Capital FM and Gadafi Athorbey Guet by Amnesty Kenya), aged 51, Kenyan-South Sudanese dual national " +
  "from Jonglei, had repeatedly warned that his life was in danger for exposing corruption linked to " +
  "South Sudan's ruling elite. Abducted at gunpoint by armed masked men at about 03:00 on Wednesday " +
  "10 June 2026 as he left a casino in Nairobi (per information his wife received from police; AFP " +
  "agency reporting) and unlawfully deported to South Sudan, where he was held at a military detention " +
  "facility in Juba for nearly two months. Amnesty International Kenya publicly demanded urgent " +
  "safeguards for him on 12 June 2026. Released on 8 August 2026 after investigations 'did not reveal " +
  "any wrongdoing' (family statement), returned to Nairobi with deteriorated health and is receiving " +
  "medical treatment; Amnesty Kenya announced his return on 11 August 2026 and demanded a transparent " +
  "investigation and accountability for all responsible.";

const args = [
  "scripts/curation-queue.mjs", "--promote", CASE,
  "--record-id", "gaddhaffy-2026-08-08",
  "--date", "2026-08-08",
  "--person", "Athorbey Al-Gaddhaffy-Dit",
  "--location", "Nairobi (abduction); Juba, South Sudan (detention)",
  "--status", "returned",
  "--category", "abduction",
  "--source-name", "radiotamazuj.org",
  "--source-url", VERIFIED[0].url,
  "--corroborating", VERIFIED.slice(1).map(v => v.url).join(" ; "),
  "--curator", "queue-watcher operator",
  "--notes", notes,
];
const r = spawnSync("node", args, { stdio: "inherit" });
process.exit(r.status ?? 0);
