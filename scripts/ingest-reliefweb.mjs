#!/usr/bin/env node
/**
 * ReliefWeb Kenya ingest.
 *
 * Run when the appname clears review:
 *   RELIEFWEB_APPNAME=kamps-earlywarning-7f3a node scripts/ingest-reliefweb.mjs
 *
 * Status: appname requested 2026-09-27 through the official form
 * (https://apidoc.reliefweb.int/parameters#appname). Until OCHA approves
 * it, the v2 API answers 403 for every appname. Approval mail goes to the
 * address on the request; set the env var and this script pulls Kenya
 * disaster and report metadata into data/reliefweb-kenya.json.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const APPNAME = process.env.RELIEFWEB_APPNAME;
const OUT = "data/reliefweb-kenya.json";

if (!APPNAME) {
  console.error(
    "RELIEFWEB_APPNAME must be set.\n" +
    "Request an appname at the form linked from https://apidoc.reliefweb.int/parameters\n" +
    "(format: org + purpose + random characters, review up to two business days)."
  );
  process.exit(1);
}

const BASE = "https://api.reliefweb.int/v2";

async function rw(path, params) {
  const qs = new URLSearchParams({ appname: APPNAME, ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`, {
    headers: { "User-Agent": `KAMPS-early-warning/1.0 (${APPNAME})` },
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    if (text.includes("not using an approved appname")) {
      console.error("ReliefWeb says the appname is not approved yet. Wait for their email and retry.");
    } else {
      console.error(`${path} responded ${res.status}: ${text}`);
    }
    process.exit(1);
  }
  return res.json();
}

console.log("Fetching Kenya disasters ...");
const disasters = await rw("disasters", {
  "filter[field]": "country.name",
  "filter[value][eq]": "Kenya",
  limit: 100,
  sort: "date:desc",
  fields: "include[name,date,description,glide,country]",
});

console.log("Fetching recent Kenya reports ...");
const reports = await rw("reports", {
  "filter[field]": "country.name",
  "filter[value][eq]": "Kenya",
  limit: 100,
  sort: "date.created:desc",
  "fields[include][]": "title,url,date.created,source.name,disaster.name",
}).catch((e) => {
  console.warn(`reports fetch failed (${e.message}); continuing with disasters only`);
  return { data: [] };
});

const payload = {
  retrieved_at: new Date().toISOString(),
  appname: APPNAME,
  disasters: (disasters.data ?? []).map((d) => ({
    id: d.id ?? d.fields?.id,
    name: d.fields?.name,
    date: d.fields?.date?.created ?? null,
    glide: d.fields?.glide ?? null,
    description: d.fields?.description?.slice?.(0, 400) ?? null,
  })),
  reports: (reports.data ?? []).map((r) => ({
    title: r.fields?.title,
    url: r.fields?.url,
    date: r.fields?.date?.created ?? null,
    source: r.fields?.source?.[0]?.name ?? null,
    disaster: r.fields?.disaster?.[0]?.name ?? null,
  })),
};

writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(
  `Wrote ${OUT}: ${payload.disasters.length} disasters, ${payload.reports.length} reports.`
);
