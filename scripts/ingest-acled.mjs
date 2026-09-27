#!/usr/bin/env node
/**
 * ACLED Kenya ingest.
 *
 * Run when ACLED credentials exist:
 *   ACLED_EMAIL=you@example.com ACLED_KEY=... node scripts/ingest-acled.mjs
 *
 * Why this is a script and not wired into the app: ACLED registration
 * (acleddata.com/register) is Cloudflare-walled from datacenter IPs and the
 * API subdomain (api.acleddata.com) does not resolve publicly from this
 * host. Register once from a normal browser, then this script pulls Kenya
 * events into data/acled-kenya.json and the engine picks them up as the
 * Tier 2 corroboration layer.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const EMAIL = process.env.ACLED_EMAIL;
const KEY = process.env.ACLED_KEY;
const OUT = "data/acled-kenya.json";

if (!EMAIL || !KEY) {
  console.error(
    "ACLED_EMAIL and ACLED_KEY must be set.\n" +
    "Register at https://acleddata.com/register (works from a normal browser),\n" +
    "confirm the email, then rerun with the key they send you."
  );
  process.exit(1);
}

const BASE = "https://api.acleddata.com/acled/read";
const params = new URLSearchParams({
  key: KEY,
  email: EMAIL,
  country: "Kenya",
  limit: 0, // everything
});

console.log(`GET ${BASE}?country=Kenya ...`);
const res = await fetch(`${BASE}?${params}`, {
  headers: { "User-Agent": "KAMPS-early-warning/1.0 (Kenya monitoring)" },
});

if (!res.ok) {
  console.error(`ACLED responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const body = await res.json();
const events = body.data ?? body.success ?? [];
if (!Array.isArray(events) || events.length === 0) {
  console.error("ACLED returned no events. Inspect the raw response:");
  console.error(JSON.stringify(body).slice(0, 600));
  process.exit(1);
}

const kenya = events.filter((e) => (e.country ?? "").toLowerCase() === "kenya");
const rows = kenya.map((e) => ({
  id: Number(e.event_id_cnty ?? e.event_id),
  date: e.event_date,
  year: Number(e.year),
  type: e.event_type,
  subType: e.sub_event_type ?? null,
  actor1: e.actor1 ?? null,
  actor2: e.actor2 ?? null,
  fatalities: Number(e.fatalities ?? 0),
  lat: Number(e.latitude),
  lng: Number(e.longitude),
  location: e.location ?? null,
  admin1: e.admin1 ?? null, // county
  admin2: e.admin2 ?? null,
  source: e.source ?? null,
  notes: e.notes ? String(e.notes).slice(0, 600) : null,
}));

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const payload = {
  version: "ACLED read API",
  retrieved_at: new Date().toISOString(),
  events: rows.length,
  coverage: rows.length
    ? `${rows.map((r) => r.date).sort()[0]}..${rows.map((r) => r.date).sort().at(-1)}`
    : null,
  previous_retrieved_at: prev?.retrieved_at ?? null,
  license: "ACLED registered access, non-commercial use",
  rows,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`Wrote ${OUT}: ${rows.length} Kenya events (${payload.coverage}).`);
console.log("Next: rerun the engine or restart the dev server to see ACLED join the sources register.");
