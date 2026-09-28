#!/usr/bin/env node
// Re-apply the verified corroboration trail to the promoted whistleblower case
// (the promote run's internal sweep had rebuilt feed-derived fields over the
// patch; with the terminal-case preservation fix in curation-queue.mjs the
// fields below now survive future sweeps).
import { readFileSync, writeFileSync } from "node:fs";

const STATE = "data/curation-queue.json";
const CASE = "south-sudanese-2026-08-10";
const VERIFIED = [
  { url: "https://www.radiotamazuj.org/en/news/article/south-sudanese-man-abducted-in-kenya-released-after-two-months", outlet: "Radio Tamazuj", title: "South Sudanese man abducted in Kenya released after two months", date: "2026-08-10" },
  { url: "https://capitalfm.africa/south-sudan-whistleblower-athorbey-released-after-nearly-two-months-in-detention/", outlet: "Capital FM Kenya", title: "South Sudan whistleblower Athorbey released after nearly two months in detention", date: "2026-08-10" },
  { url: "https://punchng.com/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/", outlet: "Punch Newspapers", title: "South Sudan Whistleblower Abducted in Kenya Released (AFP)", date: "2026-08-10" },
  { url: "https://www.eastleighvoice.co.ke/2026/08/11/whistleblower-released-following-abduction-and-deportation-to-juba/", outlet: "The Eastleigh Voice", title: "Whistleblower released following 'abduction' and deportation to Juba", date: "2026-08-11" },
  { url: "https://bodexng.com/2026/08/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/", outlet: "BodexNG", title: "South Sudan whistleblower abducted in Kenya released after two months", date: "2026-08-10" },
  { url: "https://capitalfm.africa/rights-groups-demand-urgent-safeguards-for-businessman-reportedly-abducted-in-nairobi-and-moved-to-south-sudan/", outlet: "Capital FM Kenya", title: "Rights groups demand urgent safeguards for businessman reportedly abducted in Nairobi (June abduction report)", date: "2026-06-12" },
];

const q = JSON.parse(readFileSync(STATE, "utf8"));
const c = q.queue[CASE];
if (!c || c.status !== "promoted") { console.error("case not promoted: " + CASE); process.exit(1); }
c.person = "Athorbey Al-Gaddhaffy-Dit";
c.incidentHint = "South Sudanese graft whistleblower abducted in Nairobi, deported to Juba, released after two months";
c.outlets = [...new Set(VERIFIED.map(v => v.outlet))];
c.corroboration = c.outlets.length;
c.urls = VERIFIED.map(v => v.url);
c.articles = VERIFIED.map(v => ({ title: v.title, source: v.outlet, pubDate: v.date, url: v.url }));
writeFileSync(STATE, JSON.stringify(q, null, 2));
console.log(`re-patched ${CASE}: person=${c.person}, corroboration=${c.corroboration}, recordId=${c.promotedRecordId}`);
