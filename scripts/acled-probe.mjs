#!/usr/bin/env node
/**
 * ACLED OAuth client: token acquisition (direct first, relay fallback for
 * sandbox IPs that Cloudflare challenges) + one probe query to inspect the
 * response shape. Run from repo root: node scripts/acled-probe.mjs
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const EMAIL = process.env.ACLED_EMAIL || "";
const PASSWORD = process.env.ACLED_PASSWORD || "";
const TOKEN_CACHE = ".acled-tokens.json";
const RELAY = "https://test.cors.workers.dev/?";

async function relayPost(url, headers, body) {
  const res = await fetch(RELAY + url, {
    method: "POST",
    headers: { ...headers, Origin: "https://kamps.local" },
    body,
  });
  return { status: res.status, text: await res.text() };
}
async function relayGet(url, headers) {
  const res = await fetch(RELAY + url, { headers: { ...headers, Origin: "https://kamps.local" } });
  return { status: res.status, text: await res.text() };
}

function cacheValid() {
  if (!existsSync(TOKEN_CACHE)) return null;
  try {
    const j = JSON.parse(readFileSync(TOKEN_CACHE, "utf8"));
    if (j.access_token && Date.now() < j.fetched_at + j.expires_in * 1000 - 60000) return j;
    return { ...j, expired: true };
  } catch {
    return null;
  }
}

async function getToken() {
  const cached = cacheValid();
  if (cached && !cached.expired) {
    console.log("Using cached access token (valid).");
    return cached.access_token;
  }

  const body = new URLSearchParams({
    username: EMAIL,
    password: PASSWORD,
    grant_type: "password",
    client_id: "acled",
    scope: "authenticated",
  }).toString();

  // 1. Direct
  let resp = null;
  try {
    const r = await fetch("https://acleddata.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });
    resp = { status: r.status, text: await r.text() };
  } catch (e) {
    console.log(`Direct token request failed (${e.message}), trying relay...`);
  }

  // 2. Relay fallback (Cloudflare challenges datacenter IPs)
  if (!resp || resp.status !== 200 || resp.text.includes("Just a moment")) {
    console.log("Falling back to relay for token...");
    resp = await relayPost(
      "https://acleddata.com/oauth/token",
      { "Content-Type": "application/x-www-form-urlencoded" },
      body
    );
  }

  if (resp.status !== 200) {
    console.error(`Token request failed ${resp.status}: ${resp.text.slice(0, 300)}`);
    process.exit(1);
  }
  const j = JSON.parse(resp.text);
  writeFileSync(
    TOKEN_CACHE,
    JSON.stringify({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_in: j.expires_in,
      fetched_at: Date.now(),
    })
  );
  console.log(`Token acquired. expires_in=${j.expires_in}s; refresh_token saved.`);
  return j.access_token;
}

const token = await getToken();

// Probe: 10 recent Kenya events, all default fields
const probeUrl =
  "https://acleddata.com/api/acled/read?_format=json&country=Kenya&limit=10" +
  "&fields=event_id_cnty|event_date|year|disorder_type|event_type|sub_event_type|actor1|actor2|civilian_targeting|country|admin1|admin2|location|latitude|longitude|fatalities|source|tags|notes";

let probe = null;
try {
  const r = await fetch(probeUrl, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  probe = { status: r.status, text: await r.text() };
} catch {
  probe = null;
}
if (!probe || probe.status !== 200 || probe.text.includes("Just a moment")) {
  console.log("API probe via relay...");
  probe = await relayGet(probeUrl, { Authorization: `Bearer ${token}` });
}

console.log(`Probe status: ${probe.status}`);
const pj = JSON.parse(probe.text);
console.log("Response keys:", Object.keys(pj).join(", "));
console.log("count:", pj.count, " returned:", Array.isArray(pj.data) ? pj.data.length : "?");
if (pj.data?.[0]) {
  console.log("Sample row keys:", Object.keys(pj.data[0]).join(", "));
  console.log("Sample row:", JSON.stringify(pj.data[0], null, 1).slice(0, 900));
}
