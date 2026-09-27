/**
 * Targeted VLM check on the new KAMPS panels (news watch, election clock,
 * sources register automated rows). Round 29 supplement.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ZAI = require("z-ai-web-dev-sdk").default ?? require("z-ai-web-dev-sdk");

const DIR = "/home/z/my-project/screenshots";
const shots = [
  ["nw-alerts-newswatch.png", "Alerts view, news watch panel: headline stat column (last 30 days count), most-mentioned counties list, KNCHR index, GDELT volume readout, and a list of latest matching articles as links with date and source"],
  ["nw-alerts-context.png", "Alerts view, election clock context card: mono kicker heading, months-to-election stat, explanatory paragraph"],
  ["nw-sources-automated.png", "Sources view scrolled: provenance register cards including 'Weekly auto' status badges, ACLED, news watch and GDELT cards with hydrated counts"],
  ["nw-alerts-top.png", "Alerts view top: severity count strip and the first alert cards"],
];

function img(name) {
  const b64 = fs.readFileSync(path.join(DIR, name)).toString("base64");
  return { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } };
}

const RUBRIC = `You are reviewing new UI panels of a Swiss-minimalist monitoring app (near-black on white, one red accent, mono kickers, hairline borders). Score FIVE features 1-8 (integers): typography, color, layout, components, responsive-legibility. 8 = flawless at normal viewing distance. Evidence rule: any score below 8 must name the exact element and the exact visible defect (misalignment, overlap, clipping, illegible text, broken spacing). No speculation, no zoom-peeping. If nothing visible is broken, score 8. Output strict JSON only: {"scores": {feature: n}, "findings": [{"feature": string, "defect": string, "fix": string}]}`;

const zai = await ZAI.create();
let out = "";
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RUBRIC + "\n\nScreenshots of the new panels:" },
            ...shots.flatMap(([file, desc]) => [
              { type: "text", text: `Image: ${desc}` },
              img(file),
            ]),
          ],
        },
      ],
      thinking: { type: "disabled" },
    });
    out = completion.choices[0]?.message?.content ?? "";
    break;
  } catch (e) {
    console.log(`attempt ${attempt} failed: ${String(e.message ?? e).slice(0, 80)}`);
    await new Promise(r => setTimeout(r, 15000));
  }
}
console.log(out);
try {
  const m = out.match(/\{[\s\S]*\}/);
  const j = JSON.parse(m[0]);
  const scores = Object.values(j.scores ?? {});
  console.log("\nNEW-PANEL SCORES:", j.scores, "| min:", Math.min(...scores));
} catch (e) {
  console.log("parse error", e.message);
}
