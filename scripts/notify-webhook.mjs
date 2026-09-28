#!/usr/bin/env node
/**
 * KAMPS partner webhook: ping off the weekly digest.
 *
 * Runs in the weekly pipeline right after the digest issue is filed.
 * Partners get the headline numbers and the issue link in their channel
 * without opening GitHub.
 *
 * Usage (from .github/workflows/weekly-ingest.yml):
 *   node scripts/notify-webhook.mjs digest.md "https://github.com/.../issues/N"
 *
 * Configuration:
 *   DIGEST_WEBHOOK_URL   required. One endpoint, or several comma-separated.
 *                        Every listed endpoint receives the ping.
 *
 * Endpoint auto-detection (by URL shape):
 *   hooks.slack.com | slack.com/services      -> Slack incoming-webhook payload
 *   discord.com/api/webhooks                  -> Discord message payload
 *   anything else (zapier, make, custom ...)  -> generic JSON {title, text, url, numbers}
 *
 * Behavior notes:
 *   - No DIGEST_WEBHOOK_URL set: logs a note and exits 0 (feature is opt-in).
 *   - Delivery failures log a loud warning but do not fail the pipeline;
 *     the digest issue itself is the durable record. Set KAMPS_WEBHOOK_STRICT=1
 *     to make any failed delivery exit non-zero instead.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [digestPath, issueUrlArg] = process.argv.slice(2);

if (!digestPath || !existsSync(digestPath)) {
  console.error("usage: node scripts/notify-webhook.mjs <digest.md> [issue-url]");
  process.exit(1);
}

const endpoints = (process.env.DIGEST_WEBHOOK_URL ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

if (!endpoints.length) {
  console.log("DIGEST_WEBHOOK_URL not set: no partner ping this run (opt-in via repo secret).");
  process.exit(0);
}

const digest = readFileSync(digestPath, "utf8");

// ——— pull the headline numbers out of the digest markdown ———
const titleLine = digest.match(/^#\s+(.+)$/m)?.[1] ?? "KAMPS weekly digest";
const docLine = digest.match(/\*\*(\d+) documented incidents\*\*[^.]*?(\+\d+[^)]*\))?/);
const documented = docLine?.[1] ?? null;
const delta = digest.match(/\((\+\d+|-\d+)[^)]*since last digest\)/)?.[1] ?? null;
const zones = digest.match(/Zones:\s*(\d+)\s*critical,\s*(\d+)\s*elevated/);
const critical = zones?.[1] ?? null;
const elevated = zones?.[2] ?? null;
const highest = digest.match(/Highest:\s*(.+?)\s*at index\s*([\d.]+)/);

// ——— queue state, when the watcher ran before the digest ———
let queueLine = "";
const qPath = path.join(ROOT, "data", "curation-queue.json");
if (existsSync(qPath)) {
  try {
    const q = JSON.parse(readFileSync(qPath, "utf8"));
    const by = (s) => Object.values(q.queue ?? {}).filter(c => c.status === s).length;
    const ready = Object.values(q.queue ?? {}).filter(c => c.status === "ready");
    queueLine =
      `Curator queue: ${by("ready")} ready (one verification away)` +
      (by("promoted") ? `, ${by("promoted")} promoted` : "") +
      `, ${by("pending")} pending, ${by("duplicate")} already-documented`;
    if (ready.length) {
      queueLine += ` — ready now: ${ready.map(r => r.person ?? r.incidentHint?.slice(0, 40)).slice(0, 3).join("; ")}`;
    }
  } catch { /* queue state is optional */ }
}

const issueUrl = issueUrlArg ?? "";
const L = [];
L.push(titleLine.replace(/^KAMPS /, "KAMPS "));
if (documented) {
  L.push(`${documented} documented incidents${delta ? ` ${delta} this week` : ""} · ${critical ?? "?"} critical / ${elevated ?? "?"} elevated zones`);
  if (highest) L.push(`Highest: ${highest[1]} at index ${highest[2]}`);
}
if (queueLine) L.push(queueLine);
const alerts = digest.match(/## Action-level alerts\n\n((?:- .+\n)+)/);
if (alerts) {
  const crit = (alerts[1].match(/\[CRITICAL\]/g) ?? []).length;
  const elev = (alerts[1].match(/\[ELEVATED\]/g) ?? []).length;
  if (crit || elev) L.push(`${crit} critical and ${elev} elevated action-level alerts`);
}
if (issueUrl) L.push(`Full digest: ${issueUrl}`);
const text = L.join("\n");

// ——— endpoint-specific payloads ———
// Detection by URL shape, overridable with a #slack / #discord / #json fragment
// for bridge receivers (Mattermost, Teams adapters) on arbitrary URLs.
const kindOf = (url) => {
  const frag = (url.split("#")[1] ?? "").toLowerCase();
  if (frag === "slack" || frag === "discord" || frag === "json") return frag;
  if (/hooks\.slack\.com|slack\.com\/services/.test(url)) return "slack";
  if (/discord\.com\/api\/webhooks/.test(url)) return "discord";
  return "json";
};
const payloadsFor = (kind) => {
  if (kind === "slack") return [{ json: { text } }];
  if (kind === "discord") return [{ json: { content: text.slice(0, 1900) } }];
  // generic (zapier / make / custom receiver)
  return [{
    json: {
      source: "kamps",
      event: "weekly-digest",
      title: titleLine,
      text,
      url: issueUrl,
      numbers: {
        documentedIncidents: documented ? Number(documented) : null,
        documentedDelta: delta ? Number(delta) : null,
        criticalZones: critical ? Number(critical) : null,
        elevatedZones: elevated ? Number(elevated) : null,
      },
    },
  }];
};

let failures = 0;
for (const rawUrl of endpoints) {
  const url = rawUrl.split("#")[0]; // strip the format-hint fragment
  const kind = kindOf(rawUrl);
  for (const payload of payloadsFor(kind)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.json),
      });
      if (res.ok) {
        console.log(`webhook (${kind}) delivered: ${res.status}`);
      } else {
        failures++;
        console.warn(`WEBHOOK DELIVERY FAILED (${kind}): HTTP ${res.status} from ${url.slice(0, 60)}...`);
      }
    } catch (err) {
      failures++;
      console.warn(`WEBHOOK DELIVERY FAILED (${kind}): ${err.message} (${url.slice(0, 60)}...)`);
    }
  }
}

console.log(`partner ping complete: ${endpoints.length} endpoint(s), ${failures} failure(s).`);
if (failures && process.env.KAMPS_WEBHOOK_STRICT === "1") process.exit(1);
process.exit(0);
