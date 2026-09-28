#!/usr/bin/env node
/** Local test for notify-webhook.mjs: captures POSTs and checks payloads. */
import http from "node:http";
import { writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";

const received = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => {
    received.push({ path: req.url, body });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  });
});

await new Promise(r => server.listen(4599, r));

const digest = `# KAMPS weekly digest, 2026-09-28

Engine run over the data window 2024-06-01 to 2026-09-30.

## The numbers

- **241 documented incidents** in the monitoring window (+2 since last digest), 207 county-located.
- Zones: 5 critical, 10 elevated. Highest: Nairobi at index 86.5.
- ACLED trailing 12 months: 45 abduction-coded events, 271 violence-against-civilians events.

## Curator queue

- 1 ready (one verification away), 2 pending, 6 duplicate.

## Action-level alerts

- **[CRITICAL]** CRITICAL · Nairobi (Nairobi)
- **[CRITICAL]** CRITICAL · Kiambu (Kiambu)
- **[ELEVATED]** ELEVATED · Meru (Meru)
`;
writeFileSync("/tmp/test-digest.md", digest);

const env = {
  ...process.env,
  DIGEST_WEBHOOK_URL: "http://localhost:4599/bridge#slack,http://localhost:4599/chan#discord,http://localhost:4599/hook",
};
// async spawn (NOT spawnSync): the capture server lives on THIS event loop,
// so blocking it would deadlock the child's fetch against the server.
const run = await new Promise((resolve) => {
  const child = spawn("node", [
    "scripts/notify-webhook.mjs", "/tmp/test-digest.md",
    "https://github.com/ssmurfgg04-gif/the-gap-report/issues/2",
  ], { env });
  let stdout = "", stderr = "";
  child.stdout.on("data", d => stdout += d);
  child.stderr.on("data", d => stderr += d);
  child.on("close", code => resolve({ stdout, stderr, status: code }));
});
const { status } = run;
console.log("=== notify-webhook output ===");
console.log(run.stdout, run.stderr);
console.log("exit:", status);

server.close();
rmSync("/tmp/test-digest.md");

console.log("=== captured payloads ===");
let pass = true;
for (const r of received) {
  const parsed = JSON.parse(r.body);
  console.log(`\n[${r.path}] keys:`, Object.keys(parsed).join(", "));
  console.log(String(parsed.text ?? parsed.content ?? "").slice(0, 300));
  if (r.path === "/bridge") {
    if (!("text" in parsed)) { pass = false; console.log("FAIL: slack payload missing text"); }
  } else if (r.path === "/chan") {
    if (!("content" in parsed)) { pass = false; console.log("FAIL: discord payload missing content"); }
  } else {
    if (parsed.numbers?.documentedIncidents !== 241) { pass = false; console.log("FAIL: generic numbers wrong", parsed.numbers); }
    if (parsed.url !== "https://github.com/ssmurfgg04-gif/the-gap-report/issues/2") { pass = false; console.log("FAIL: url missing"); }
  }
}
const text0 = JSON.parse(received.find(r => r.path === "/bridge").body).text;
if (!text0.includes("241 documented incidents +2 this week")) { pass = false; console.log("FAIL: delta not parsed:", text0); }
if (!text0.includes("5 critical / 10 elevated")) { pass = false; console.log("FAIL: zones not parsed"); }
if (!text0.includes("2 critical and 1 elevated action-level alerts")) { pass = false; console.log("FAIL: alerts not parsed"); }
if (!text0.includes("issues/2")) { pass = false; console.log("FAIL: issue link missing"); }
console.log(pass ? "\nALL WEBHOOK TESTS PASSED" : "\nWEBHOOK TESTS FAILED");
process.exit(pass ? 0 : 1);
