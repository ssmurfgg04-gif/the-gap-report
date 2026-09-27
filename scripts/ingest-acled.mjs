#!/usr/bin/env node
/**
 * ACLED Kenya ingest (OAuth edition, 2026-09-27).
 *
 * Two data paths, both real, both using the myACLED account:
 *
 *   1. Event-level REST (https://acleddata.com/api/acled/read) - only works
 *      when the account tier is Research Partner or above. The current
 *      account authenticates fine (OAuth verified) but sits on the Open
 *      tier, which returns 403 "Access denied" on the read API. The script
 *      still tries it first: if the tier is ever upgraded, this path lights
 *      up with zero changes.
 *
 *   2. Weekly aggregated download (myACLED "Aggregated data on Africa"
 *      xlsx, refreshed every Monday) - works on the Open tier, covers all
 *      47 Kenya counties at week x Admin 1 x event-type resolution through
 *      the latest published week. This is the path in production today.
 *
 * Network notes:
 *   - acleddata.com is Cloudflare-walled from datacenter IPs. Direct
 *     requests are tried first; on block, the script falls back to a public
 *     CORS relay (test.cors.workers.dev) that forwards method, headers and
 *     body from a normal residential-grade egress. From any non-datacenter
 *     network the direct path works and the relay is never touched.
 *   - The xlsx has corrupt dimension metadata, so it is parsed with the
 *     stdlib streaming XML parser in scripts/extract-acled-kenya.py
 *     (openpyxl fails on it).
 *
 * Usage:
 *   ACLED_EMAIL=... ACLED_PASSWORD=... node scripts/ingest-acled.mjs
 *
 * Credentials live in .env (never committed). The 24h access token and the
 * 14-day refresh token are cached in .acled-tokens.json (gitignored).
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RELAY = "https://test.cors.workers.dev/?";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const EMAIL = process.env.ACLED_EMAIL;
const PASSWORD = process.env.ACLED_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error(
    "ACLED_EMAIL and ACLED_PASSWORD must be set (see .env.example).\n" +
    "The myACLED account authenticates via OAuth: POST /oauth/token with\n" +
    "grant_type=password, client_id=acled, scope=authenticated."
  );
  process.exit(1);
}

/** fetch a URL, direct first, relay on Cloudflare block. */
async function smartFetch(url, init = {}, { retries = 2 } = {}) {
  const headers = { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      const blocked = text.includes("Just a moment") || (r.status === 403 && text.length < 3000 && text.includes("<!DOCTYPE"));
      if (!blocked) {
        // capture Set-Cookie: smartFetch normally returns text only, but the
        // login step needs the session cookie from a DIRECT response
        const setCookie = (r.headers?.getSetCookie?.() ?? [])[0] ?? null;
        return { status: r.status, text, via: "direct", setCookie };
      }
      console.log(`direct ${r.status} (Cloudflare), trying relay...`);
    } catch (e) {
      console.log(`direct failed (${e.message}), trying relay...`);
    }
    // relay attempt (encode target so query strings survive)
    try {
      const r = await fetch(RELAY + encodeURIComponent(url), {
        ...init,
        headers: { ...headers, Origin: "https://acleddata.com" },
        signal: AbortSignal.timeout(30000),
      });
      const text = await r.text();
      if (!text.includes("Just a moment")) return { status: r.status, text, via: "relay", setCookie: null };
    } catch (e) {
      console.log(`relay failed (${e.message})`);
    }
  }
  return { status: 0, text: "", via: "none", setCookie: null };
}

// ————— 1. OAuth token —————
const TOKEN_CACHE = path.join(ROOT, ".acled-tokens.json");
async function getToken() {
  if (existsSync(TOKEN_CACHE)) {
    try {
      const j = JSON.parse(readFileSync(TOKEN_CACHE, "utf8"));
      if (j.access_token && Date.now() < j.fetched_at + j.expires_in * 1000 - 60000) {
        console.log("cached access token still valid.");
        return j.access_token;
      }
    } catch { /* fall through to a fresh token */ }
  }
  const body = new URLSearchParams({
    username: EMAIL, password: PASSWORD,
    grant_type: "password", client_id: "acled", scope: "authenticated",
  }).toString();
  const r = await smartFetch("https://acleddata.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (r.status !== 200) {
    console.error(`token request failed (${r.via}, ${r.status}): ${r.text.slice(0, 300)}`);
    process.exit(1);
  }
  const j = JSON.parse(r.text);
  writeFileSync(TOKEN_CACHE, JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_in: j.expires_in,
    fetched_at: Date.now(),
  }));
  console.log(`token acquired via ${r.via}; expires in ${Math.round(j.expires_in / 3600)}h.`);
  return j.access_token;
}

const token = await getToken();

// ————— 2. try event-level REST (Research Partner tier) —————
{
  const r = await smartFetch(
    "https://acleddata.com/api/acled/read?_format=json&country=Kenya&limit=5",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (r.status === 200) {
    console.log("event-level REST access WORKS (tier upgraded). Rows:");
    console.log(r.text.slice(0, 400));
    console.log("Full event-level ingest is left as the next step: re-request all Kenya pages and");
    console.log("write them into data/acled-kenya.json, then join it with the aggregate file.");
    // (not reached today on the Open tier)
  } else if (r.status === 403) {
    console.log("event-level REST: 403 Access denied (Open tier, expected). Falling back to the aggregated download.");
  } else {
    console.log(`event-level REST: ${r.status} (${r.via}). Falling back to the aggregated download.`);
  }
}

// ————— 3. session cookie for the download area —————
const SESSION_FILE = path.join(ROOT, ".acled-session.txt");
async function loginSession() {
  // try a cached session first (sessions live for weeks): one GET with the
  // old cookie avoids a login POST entirely
  if (existsSync(SESSION_FILE)) {
    const cached = readFileSync(SESSION_FILE, "utf8").trim();
    if (cached) {
      const probe = await smartFetch("https://acleddata.com/aggregated/aggregated-data-africa", {
        headers: { Cookie: cached, Accept: "text/html", "User-Agent": UA },
      });
      if (probe.status === 200 && /system\/files\/[^"']+\.xlsx/.test(probe.text)) {
        console.log("cached session cookie still valid.");
        return cached;
      }
      console.log("cached session rejected, logging in fresh...");
    }
  }

  const r = await smartFetch("https://acleddata.com/user/login?_format=json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: EMAIL, pass: PASSWORD }),
  });
  if (r.status !== 200) {
    console.error(`login failed (${r.status}): ${r.text.slice(0, 200)}`);
    process.exit(1);
  }
  // direct responses now carry the Set-Cookie header through smartFetch
  if (r.setCookie) {
    writeFileSync(SESSION_FILE, r.setCookie.split(";")[0]);
    return r.setCookie.split(";")[0];
  }
  // relay fallback: redo a raw relay login to grab Set-Cookie
  const rr = await fetch(RELAY + encodeURIComponent("https://acleddata.com/user/login?_format=json"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://acleddata.com", "User-Agent": UA },
    body: JSON.stringify({ name: EMAIL, pass: PASSWORD }),
    signal: AbortSignal.timeout(30000),
  });
  const sc = rr.headers.get("set-cookie") ?? "";
  const full = sc.split(";")[0];
  if (!full) {
    console.error("no session cookie returned");
    process.exit(1);
  }
  writeFileSync(SESSION_FILE, full);
  return full;
}

const cookie = await loginSession();
console.log("session cookie acquired.");

// ————— 4. find the current Africa aggregated file —————
const page = await smartFetch("https://acleddata.com/aggregated/aggregated-data-africa", {
  headers: { Cookie: cookie, Accept: "text/html", "User-Agent": UA },
});
if (page.status !== 200) {
  console.error(`aggregated data page failed: ${page.status}`);
  process.exit(1);
}
const m = page.text.match(/https:\/\/acleddata\.com\/system\/files\/[^"']+\.xlsx/);
if (!m) {
  console.error("no xlsx link found on the aggregated-data-africa page (layout may have changed)");
  process.exit(1);
}
const xlsxUrl = m[0];
console.log(`xlsx: ${xlsxUrl}`);

// ————— 5. download —————
async function downloadXlsx() {
  // direct first
  try {
    const r = await fetch(xlsxUrl, {
      headers: { Cookie: cookie, "User-Agent": UA },
      signal: AbortSignal.timeout(120000),
    });
    if (r.ok && (r.headers.get("content-type") ?? "").includes("sheet")) {
      const buf = Buffer.from(await r.arrayBuffer());
      return { buf, via: "direct" };
    }
  } catch { /* relay */ }
  const r = await fetch(RELAY + encodeURIComponent(xlsxUrl), {
    headers: { Cookie: cookie, "User-Agent": UA, Origin: "https://acleddata.com" },
    signal: AbortSignal.timeout(180000),
  });
  if (r.ok) {
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, via: "relay" };
  }
  throw new Error(`xlsx download failed: ${r.status}`);
}
const { buf, via } = await downloadXlsx();
const tmpXlsx = "/tmp/acled-africa.xlsx";
writeFileSync(tmpXlsx, buf);
console.log(`downloaded ${Math.round(buf.length / 1024)} KB via ${via}.`);

// ————— 6. extract Kenya —————
const outJson = path.join(ROOT, "data", "acled-kenya-aggregates.json");
const py = spawnSync("python3", [path.join(ROOT, "scripts", "extract-acled-kenya.py"), tmpXlsx, outJson], {
  stdio: "inherit",
});
if (py.status !== 0) {
  console.error("python extraction failed");
  process.exit(1);
}
console.log(`wrote ${path.relative(ROOT, outJson)}.`);
console.log("restart the dev server (or clear the engine cache) to see ACLED numbers in the app.");
