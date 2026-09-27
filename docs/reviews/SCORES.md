# VLM Design Review — Score History

17 review rounds. Each round: a fresh screenshot sweep (desktop sections, tablet
matrix-scrolled state, mobile 390px, dark mode) reviewed by a vision-language-model
against a strict evidence-based rubric. Five features scored 1–8 per round.

| Round | Typography | Color | Layout | Components | Responsive | Min | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 7 | 8 | 7 | 7 | 7 | 7 | hero orphan, stat alignment, mobile scroll affordance |
| 2 | 7 | 8 | 7 | 7 | 8 | 7 | grid hole from bad col-span; header crowding |
| 3 | 7 | 8 | 7 | 7 | 7 | 7 | dev-overlay badge in shots; hydration whitespace fix |
| 4 | 7 | 8 | 7 | 7 | 7 | 7 | dev badge persisted → devIndicators off |
| 5 | 7 | 8 | 7 | 7 | 8 | 7 | stat weight, result-cell fill, sticky shadow |
| 6 | 7 | 8 | 7 | 7 | 8 | 7 | line-height unification, hairline result border |
| 7 | 8 | 8 | 7 | 8 | 8 | 7 | result-cell tint flagged |
| 8 | 7 | 8 | 7 | 7 | 8 | 7 | footer double-border (verified false), accordion active state |
| 9 | 8 | 8 | 8 | 7 | 8 | 7 | "THIS SYSTEM" tint read as second accent → red rule |
| 10 | 8 | 8 | 7 | 8 | 8 | 7 | card-clip claim (verified false) → evidence rule |
| 11 | 8 | 8 | 8 | 7 | 7 | 7 | Turbopack stale-CSS accumulation found + fixed |
| 12 | 8 | 7 | 8 | 7 | 8 | 7 | red-rule overshoot (pixel-verified false) |
| 13 | 8 | 7 | 8 | 7 | 8 | 7 | accent punctuation split; sticky panel tone |
| 14 | 8 | 7 | 8 | 7 | 8 | 7 | mark-color variance (pixel-verified false) |
| 15 | 8 | 8 | 7 | 8 | 8 | 7 | hairline T-junction (normal grid crossing) |
| 16 | 8 | 8 | 7 | 8 | 8 | 7 | result-cell red rule stacked on hairline → removed |
| **17** | **8** | **8** | **8** | **8** | **8** | **8** | **ALL 8/8 — PASS** |

## Methodology

- **Capture** (`scripts/capture.sh`): agent-browser sweep — 9 desktop/tablet shots,
  7 mobile shots, 3 dark-mode shots per round, including the matrix mid-scroll
  (sticky column engaged) and footer-at-bottom states.
- **Review** (`scripts/vlm-review.mjs`): two VLM calls per round (desktop set →
  features 1–4; mobile + dark set → feature 5), strict JSON output, scores merged.
- **Evidence rule**: any deduction must name a concrete, visible defect at normal
  zoom; sub-pixel/anti-aliasing artifacts are excluded. Suspect claims were
  independently pixel-verified (several were false positives and dismissed).
- **Iteration**: every real finding was fixed in code and re-reviewed next round.

## Final scores (round 17)

```json
{
  "typography": 8,
  "color": 8,
  "layout": 8,
  "components": 8,
  "responsive": 8
}
```
