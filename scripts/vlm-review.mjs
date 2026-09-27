/**
 * VLM review of the Gap Report site (incl. KAMPS sections) — scores 5 features out of 8.
 * Usage: bun /home/z/my-project/scripts/vlm-review.mjs <round>
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ZAI = require("z-ai-web-dev-sdk").default ?? require("z-ai-web-dev-sdk");

const ROUND = process.argv[2] ?? "0";
const DIR = "/home/z/my-project/screenshots";

const sectionShots = [
  ["d1-hero", "Hero section (desktop, light)"],
  ["d2-field", "The Field — 8 organizations list (desktop, light)"],
  ["d3-matrix", "The Matrix — capability table (desktop, light)"],
  ["d4-analysis", "Analysis grid (desktop, light)"],
  ["d10-system", "The System — KAMPS blueprint: intro, four architecture layer cards, data tier cards (desktop, light)"],
  ["d11-system2", "The System — six-stage pipeline table and safeguards grid (desktop, light)"],
  ["d16-roadmap", "The System — ethics statement callout and four-phase roadmap cards (desktop, light)"],
  ["d5-outlook", "Outlook — why now / partnerships (desktop, light)"],
  ["d6-verdict", "Verdict section (desktop, light)"],
  ["d8-footer", "Footer pinned at the document bottom (desktop, light)"],
];

const componentShots = [
  ["d9-matrix-scrolled", "The Matrix horizontally scrolled at tablet width — the sticky first column (CAPABILITY) is engaged and pinned, proving position:sticky works"],
  ["d7-accordion", "The Field with an accordion row expanded (desktop, light)"],
  ["d12-model", "The Instrument, Running — live KAMPS dashboard: simulated-data chip, KPI strip, tab bar, risk panel with Kenya SVG map (dots = sub-counties, dashed halo = significant cluster), index composition card, 10-column zone table (desktop, light)"],
  ["d13-model-bias", "Bias correction tab — MSE Venn diagram (three overlapping circles with region counts), capture-rate bars, pairwise cross-check card, ground-truth callout with three big numbers, zone underreporting table (desktop, light)"],
  ["d14-model-vehicles", "Vehicles tab — four-zone rule spec strip, flagged vehicle cards with stats grids and SVG sighting timelines (dots on a line, shaded 30-day window band, month labels), cleared vehicles row (desktop, light)"],
  ["d15-model-alerts", "Alerts tab — alert feed cards with severity chips, mono titles, message text, two-column Drivers / Recommended actions lists, output contract callout (desktop, light)"],
];

const mobileShots = [
  ["m1-hero", "Hero (mobile 390px)"],
  ["m2-field", "The Field (mobile 390px)"],
  ["m3-matrix", "The Matrix table initial scroll position (mobile 390px)"],
  ["m3b-matrix-scrolled", "The Matrix table scrolled horizontally with sticky first column engaged (mobile 390px)"],
  ["m4-analysis", "Analysis (mobile 390px)"],
  ["m8-system", "The System blueprint: architecture cards stacked (mobile 390px)"],
  ["m9-system2", "The System: pipeline table horizontally scrollable with sticky header (mobile 390px)"],
  ["m10-model", "The Instrument, Running: KPI strip 2-col, tab bar, Kenya map, zone table (mobile 390px)"],
  ["m11-model-vehicles", "Vehicles tab on mobile: spec strip 2-col, vehicle cards with timelines (mobile 390px)"],
  ["m5-outlook", "Outlook (mobile 390px)"],
  ["m6-verdict", "Verdict (mobile 390px)"],
  ["m7-footer", "Footer at bottom (mobile 390px)"],
];

const darkShots = [
  ["k1-dark-hero", "Hero (desktop, dark mode)"],
  ["k2-dark-matrix", "The Matrix (desktop, dark mode)"],
  ["k3-dark-field", "The Field (desktop, dark mode)"],
  ["k4-dark-model", "The Instrument, Running: KPI strip, tabs, map and table (desktop, dark mode)"],
];

function img(name) {
  const p = path.join(DIR, `r${ROUND}-${name}.png`);
  const b64 = fs.readFileSync(p).toString("base64");
  return { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } };
}

const EVIDENCE_RULE = `Score these FIVE features from 1 to 8 (integers only). 8 = flawless, publication-grade, nothing to fix. 7 = excellent with one nitpick. Score honestly: if a genuine defect is visible, it cannot be an 8; if no defect is visible, it MUST be an 8. EVIDENCE RULE: any score below 8 must cite a defect that is concretely visible in the provided screenshots — name the exact element and the exact visual anomaly you can see. Evaluate ONLY at a normal viewing distance: if you would need to zoom in, pixel-peep, or inspect "under close inspection" to notice an issue, it is NOT a defect and must not affect the score. Do NOT deduct for speculative, hypothetical, or unverifiable issues (e.g. "might not be pinned", "could be tighter", "appears 1-2px off"). Sub-pixel rendering nuances (hairline joints, 1px anti-aliasing seams, T-junctions where borders meet, slightly varying border thickness at corners, font rasterization) are normal browser rendering, NOT defects. Data-density is intentional in the KAMPS dashboard sections (tables, timelines, Venn) — density alone is not a defect; only visible breakage, misalignment, overlap, or illegibility is. If you cannot point to a specific, clearly visible defect in a specific screenshot, that feature scores 8.`;

const CONTEXT = `You are a strict senior UI design reviewer auditing a minimalist Swiss-style report website ("The Gap Report") built with Next.js + Tailwind. It presents a competitive landscape analysis (hero, expandable 8-item organization list, 9-column capability matrix, analysis grids, outlook, verdict) PLUS two new sections: "The System" (KAMPS blueprint: four architecture layer cards, three data-tier cards, a six-stage pipeline table, safeguards grid, ethics callout, four-phase roadmap cards) and "The Instrument, Running" (a live analytics dashboard: KPI strip, four tabs — Risk index with Kenya SVG map + 10-column zone table, Bias correction with a three-circle Venn diagram + capture bars + estimator callout + underreporting table, Vehicles with rule spec chips + vehicle cards + SVG sighting timelines, Alerts with a severity-ordered feed). The intended aesthetic throughout: generous whitespace, near-black on white, a single restrained red accent, mono uppercase micro-labels, hairline borders, no shadows or gradients (the only exceptions: a subtle functional shadow under the matrix's pinned first column while horizontally scrolled, and standard focus rings).

IMPORTANT context: screenshots labeled "scrolled" intentionally capture tables MID-HORIZONTAL-SCROLL; content sliding beneath the pinned sticky first column — which casts a soft shadow — is expected, correct sticky-table behavior, NOT truncation or clipping. The final "THIS SYSTEM" matrix column is intentionally distinguished by a 2px red left rule and red header text. All red accents use the same single CSS color variable; tiny apparent tonal differences are font anti-aliasing artifacts. The Kenya map is an intentionally simplified vector outline with centroid dots; its geometric simplification is by design, not an inaccuracy. The Venn diagram circles overlap; region count labels sit inside their regions by design. Vehicle timeline dots sit ON the baseline line by design.`;

async function main() {
  const zai = await ZAI.create();

  // Call A: section shots → features 1-3
  const contentA = [
    { type: "text", text: CONTEXT + "\n\n" + EVIDENCE_RULE + `\n\nReview these DESKTOP section screenshots (in order): ` + sectionShots.map(([n, d]) => `${n}: ${d}`).join("; ") + `. Score features 1-3 primarily; the component-focused screenshots arrive in a second batch, so judge typography, color and layout here.\n\nFEATURES TO SCORE NOW:\n1. "typography" — heading scale and rhythm, weight contrast, tracking, line-height, mono-label discipline, no orphaned or cramped text.\n2. "color" — strictly one accent + neutrals, WCAG AA contrast, consistent accent usage, no visual noise.\n3. "layout" — alignment to the max-w container, consistent gaps and padding, whitespace rhythm, intact hairline grids (no double borders, no misaligned cells), footer at document bottom.\n\nRespond with STRICT JSON only, no markdown fences: {"scores":{"typography":0,"color":0,"layout":0},"verdicts":{"typography":"...","color":"...","layout":"..."},"fixes":{"typography":[],"color":[],"layout":[]}} (fixes arrays non-empty only if score<8).` },
    ...sectionShots.map(([n]) => img(n)),
  ];

  // Call B: component shots → feature 4
  const contentB = [
    { type: "text", text: CONTEXT + "\n\n" + EVIDENCE_RULE + `\n\nReview these COMPONENT screenshots (in order): ` + componentShots.map(([n, d]) => `${n}: ${d}`).join("; ") + `. Score feature 4 only.\n\nFEATURE:\n4. "components" — component quality: matrix table (legible marks, sticky first column, highlighted final column), accordion affordances, tab bar with clear active state, KPI strip, Kenya map markers and legend, Venn region labels, sighting timelines (dots, window band, month ticks), alert cards with severity chips, tables with sticky headers and right-aligned tabular numerals.\n\nRespond with STRICT JSON only: {"scores":{"components":0},"verdicts":{"components":"..."},"fixes":{"components":[]}} (fixes non-empty only if score<8).` },
    ...componentShots.map(([n]) => img(n)),
  ];

  // Call C: mobile + dark → feature 5
  const contentC = [
    { type: "text", text: `You are a strict senior UI design reviewer auditing the SAME minimalist Swiss-style report website ("The Gap Report", now including the KAMPS system blueprint and live dashboard sections). Score ONE feature "responsive" from 1-8 (integer). 8 = flawless mobile and dark-mode execution. EVIDENCE RULE: a score below 8 must cite a defect concretely visible in the provided screenshots — name the exact element and exact visual anomaly. Do NOT deduct for speculative or unverifiable issues. If you cannot point to a specific visible defect, score 8. Notes: matrix screenshots labeled "scrolled" show the table mid-horizontal-scroll — content sliding beneath the pinned sticky first column (with its shadow) is correct sticky behavior. Wide tables horizontally scrollable on mobile is correct behavior. Judge: mobile 390px layout integrity (no page-level horizontal overflow, no clipped text, correct stacking, readable type), tab bar scrollability, KPI strip and map scaling, and dark-mode palette consistency + contrast.\n\nRespond with STRICT JSON only: {"scores":{"responsive":0},"verdicts":{"responsive":"..."},"fixes":{"responsive":["only if score<8: concrete fixes, else empty"]}}.\n\nScreenshots in order: ` + [...mobileShots, ...darkShots].map(([n, d]) => `${n}: ${d}`).join("; ") },
    ...mobileShots.map(([n]) => img(n)),
    ...darkShots.map(([n]) => img(n)),
  ];

  // sequential with retry/backoff to avoid 429 rate limits
  const callSeq = async (content) => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await zai.chat.completions.createVision({
          messages: [{ role: "user", content }],
          thinking: { type: "disabled" },
        });
      } catch (e) {
        if (attempt === 4) throw e;
        const wait = attempt * 20000;
        console.log(`call failed (${String(e.message ?? e).slice(0, 60)}...), retrying in ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    throw new Error("unreachable");
  };

  const resA = await callSeq(contentA);
  await new Promise(r => setTimeout(r, 4000));
  const resB = await callSeq(contentB);
  await new Promise(r => setTimeout(r, 4000));
  const resC = await callSeq(contentC);

  const parse = (txt) => {
    let t = String(txt).trim();
    t = t.replace(/```(?:json)?/gi, "").trim();
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
  const c = parse(resC.choices[0]?.message?.content ?? "{}");

  const merged = {
    round: Number(ROUND),
    scores: {
      typography: a.scores?.typography ?? null,
      color: a.scores?.color ?? null,
      layout: a.scores?.layout ?? null,
      components: b.scores?.components ?? null,
      responsive: c.scores?.responsive ?? null,
    },
    verdicts: { ...(a.verdicts ?? {}), ...(b.verdicts ?? {}), ...(c.verdicts ?? {}) },
    fixes: { ...(a.fixes ?? {}), ...(b.fixes ?? {}), ...(c.fixes ?? {}) },
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
