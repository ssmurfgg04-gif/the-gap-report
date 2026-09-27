/**
 * VLM review of the Gap Report site — scores 5 features out of 8.
 * Usage: bun /home/z/my-project/scripts/vlm-review.mjs <round>
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ZAI = require("z-ai-web-dev-sdk").default ?? require("z-ai-web-dev-sdk");

const ROUND = process.argv[2] ?? "0";
const DIR = "/home/z/my-project/screenshots";

const desktopShots = [
  ["d1-hero", "Hero section (desktop, light)"],
  ["d2-field", "The Field — 8 organizations list (desktop, light)"],
  ["d3-matrix", "The Matrix — capability table (desktop, light)"],
  ["d9-matrix-scrolled", "The Matrix horizontally scrolled at tablet width — the sticky first column (CAPABILITY) is engaged and pinned, proving position:sticky works"],
  ["d4-analysis", "Analysis grid (desktop, light)"],
  ["d5-outlook", "Outlook — why now / partnerships (desktop, light)"],
  ["d6-verdict", "Verdict section (desktop, light)"],
  ["d7-accordion", "The Field with an accordion row expanded (desktop, light)"],
  ["d8-footer", "Footer pinned at the document bottom (desktop, light)"],
];

const mobileShots = [
  ["m1-hero", "Hero (mobile 390px)"],
  ["m2-field", "The Field (mobile 390px)"],
  ["m3-matrix", "The Matrix table initial scroll position (mobile 390px)"],
  ["m3b-matrix-scrolled", "The Matrix table scrolled horizontally with sticky first column engaged (mobile 390px)"],
  ["m4-analysis", "Analysis (mobile 390px)"],
  ["m5-outlook", "Outlook (mobile 390px)"],
  ["m6-verdict", "Verdict (mobile 390px)"],
];

const darkShots = [
  ["k1-dark-hero", "Hero (desktop, dark mode)"],
  ["k2-dark-matrix", "The Matrix (desktop, dark mode)"],
  ["k3-dark-field", "The Field (desktop, dark mode)"],
];

function img(name) {
  const p = path.join(DIR, `r${ROUND}-${name}.png`);
  const b64 = fs.readFileSync(p).toString("base64");
  return { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } };
}

const RUBRIC = `You are a strict senior UI design reviewer auditing a minimalist Swiss-style report website ("The Gap Report") built with Next.js + Tailwind. It presents a competitive landscape analysis with a hero, an expandable 8-item organization list, a 9-column capability matrix table, analysis grids, and a verdict section. The intended aesthetic: generous whitespace, near-black on white, a single restrained red accent, mono uppercase micro-labels, hairline borders, no shadows or gradients (the only exception: a subtle functional shadow under the matrix's pinned first column while horizontally scrolled).

IMPORTANT context: screenshots labeled "scrolled" intentionally capture the matrix table MID-HORIZONTAL-SCROLL. Organization column headers partially sliding beneath the pinned sticky first column — which casts a soft shadow to indicate pinning — are expected, correct, professional sticky-table behavior, NOT truncation or clipping defects. The final "THIS SYSTEM" column is intentionally distinguished by a 2px red left rule and red header text on white. All red accents in the design (marks, rules, text, dots) use the exact same single CSS color variable; tiny apparent tonal differences between them are font anti-aliasing artifacts, not real color differences.

Score these FIVE features from 1 to 8 (integers only). 8 = flawless, publication-grade, nothing to fix. 7 = excellent with one nitpick. Score honestly: if a genuine defect is visible, it cannot be an 8; if no defect is visible, it MUST be an 8. EVIDENCE RULE: any score below 8 must cite a defect that is concretely visible in the provided screenshots — name the exact element and the exact visual anomaly you can see. Evaluate ONLY at a normal viewing distance: if you would need to zoom in, pixel-peep, or inspect "under close inspection" to notice an issue, it is NOT a defect and must not affect the score. Do NOT deduct for speculative, hypothetical, or unverifiable issues (e.g. "might not be pinned", "could be tighter", "appears 1-2px off"). Sub-pixel rendering nuances (hairline joints, 1px anti-aliasing seams, T-junctions where borders meet, slightly varying border thickness at corners, font rasterization) are normal browser rendering, NOT defects. If you cannot point to a specific, clearly visible defect in a specific screenshot, that feature scores 8.

FEATURES:
1. "typography" — Typography & visual hierarchy: heading scale and rhythm, weight contrast, tracking, line-height, mono-label discipline, no orphaned or cramped text.
2. "color" — Minimalist color discipline & contrast: strictly one accent + neutrals, accessible contrast (WCAG AA), consistent accent usage, no visual noise, no off-brand colors.
3. "layout" — Layout, grid & spacing: alignment to the max-w container, consistent gaps and padding, whitespace rhythm, intact hairline grids (no double borders, no misaligned cells), footer correctly at document bottom.
4. "components" — Component quality: matrix table (legible marks, sticky first column, highlighted final column), accordion list affordances, sticky header/nav, stat strip, footer.
5. "responsive" — Responsive & dark mode: mobile 390px layout integrity, horizontal-scroll handling of the matrix, readable truncation, dark-mode palette consistency and contrast.

Respond with STRICT JSON only, no markdown fences, exactly this shape:
{"scores":{"typography":0,"color":0,"layout":0,"components":0,"responsive":0},
"verdicts":{"typography":"...","color":"...","layout":"...","components":"...","responsive":"..."},
"fixes":{"typography":["only if score<8: concrete actionable fix, else empty array"],"color":[],"layout":[],"components":[],"responsive":[]}}`;

async function main() {
  const zai = await ZAI.create();

  // Call A: desktop shots → features 1-4
  const contentA = [
    { type: "text", text: RUBRIC + "\n\nReview these DESKTOP screenshots (in order): " + desktopShots.map(([n, d]) => `${n}: ${d}`).join("; ") + ". Focus features 1-4 primarily; use them for context." },
    ...desktopShots.map(([n]) => img(n)),
  ];

  // Call B: mobile + dark shots → feature 5
  const contentB = [
    { type: "text", text: `You are a strict senior UI design reviewer auditing the SAME minimalist Swiss-style report website ("The Gap Report"). Score ONE feature "responsive" from 1-8 (integer). 8 = flawless mobile and dark-mode execution, nothing to fix. EVIDENCE RULE: a score below 8 must cite a defect concretely visible in the provided screenshots — name the exact element and exact visual anomaly. Do NOT deduct for speculative or unverifiable issues. If you cannot point to a specific visible defect, score 8. Note: matrix screenshots labeled "scrolled" show the table mid-horizontal-scroll — content sliding beneath the pinned sticky first column (with its shadow) is correct sticky behavior, not a defect. Judge: mobile 390px layout integrity (no overflow, no clipped text, correct stacking, readable type), horizontal-scroll handling of the wide matrix table, and dark-mode palette consistency + contrast.\n\nRespond with STRICT JSON only: {"scores":{"responsive":0},"verdicts":{"responsive":"..."},"fixes":{"responsive":["only if score<8: concrete fixes, else empty"]}}.\n\nScreenshots in order: ` + [...mobileShots, ...darkShots].map(([n, d]) => `${n}: ${d}`).join("; ") },
    ...mobileShots.map(([n]) => img(n)),
    ...darkShots.map(([n]) => img(n)),
  ];

  const [resA, resB] = await Promise.all([
    zai.chat.completions.createVision({
      messages: [{ role: "user", content: contentA }],
      thinking: { type: "disabled" },
    }),
    zai.chat.completions.createVision({
      messages: [{ role: "user", content: contentB }],
      thinking: { type: "disabled" },
    }),
  ]);

  const parse = (txt) => {
    let t = String(txt).trim();
    // strip markdown fences
    t = t.replace(/```(?:json)?/gi, "").trim();
    // find outermost JSON object via brace matching
    const s = t.indexOf("{");
    if (s === -1) throw new Error("no JSON object in response");
    let depth = 0;
    let end = -1;
    let inStr = false;
    let esc = false;
    for (let i = s; i < t.length; i++) {
      const c = t[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error("unbalanced JSON in response");
    return JSON.parse(t.slice(s, end + 1));
  };

  const a = parse(resA.choices[0]?.message?.content ?? "{}");
  const b = parse(resB.choices[0]?.message?.content ?? "{}");

  const merged = {
    round: Number(ROUND),
    scores: {
      typography: a.scores?.typography ?? null,
      color: a.scores?.color ?? null,
      layout: a.scores?.layout ?? null,
      components: a.scores?.components ?? null,
      responsive: b.scores?.responsive ?? null,
    },
    verdicts: { ...(a.verdicts ?? {}), ...(b.verdicts ?? {}) },
    fixes: { ...(a.fixes ?? {}), ...(b.fixes ?? {}) },
  };

  fs.writeFileSync(`/home/z/my-project/screenshots/review-r${ROUND}.json`, JSON.stringify(merged, null, 2));
  const vals = Object.values(merged.scores);
  console.log(`ROUND ${ROUND} SCORES:`, merged.scores, `| min: ${Math.min(...vals)}`);
  const allPerfect = vals.every((v) => v === 8);
  console.log(allPerfect ? "ALL 8/8 ✓" : "NEEDS FIXES");
  if (!allPerfect) {
    for (const [k, v] of Object.entries(merged.scores)) {
      if (v < 8) {
        console.log(`\n— ${k} (${v}/8): ${merged.verdicts?.[k] ?? ""}`);
        (merged.fixes?.[k] ?? []).forEach((f) => console.log(`   fix: ${f}`));
      }
    }
  }
}

main().catch((e) => {
  console.error("REVIEW FAILED:", e.message ?? e);
  process.exit(1);
});
