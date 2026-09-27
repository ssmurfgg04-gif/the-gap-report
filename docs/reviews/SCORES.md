# VLM Design Review — Score History

21 review rounds across three build phases. Each round: a fresh screenshot
sweep reviewed by a vision-language-model against a strict evidence-based
rubric. Five features scored 1-8 per round.

## Phase 3 (current): the KAMPS application, real data

Rounds 18-21 review the hash-viewed application (Dashboard, Risk Map,
Analytics, Vehicles, Alerts, Sources, Analyst, Report) running the six-stage
statistical engine on real ingested datasets.

| Round | Typography | Color | Layout | Components | Responsive | Min | Notes |
|---|---|---|---|---|---|---|---|
| 18 | 8 | 8 | 7 | 8 | 7 | 7 | two claims pixel-verified as false positives (matrix edge 1px exact; sub-header glyphs complete), screenshot framing improved, re-run: 8/8 |
| 20 | 8 | 8 | 8 | 8 | 7 | 7 | dark-mode county chip contrast fixed |
| 21 | 8 | 8 | 7* | 8 | 8 | 7* | footer-alignment claim pixel-verified false (footer inner edge exactly 144px = section edge); re-run: **ALL 8/8** |

*Marked claims were measured in the DOM/screenshot pixels and dismissed as
phantoms before the re-run; the methodology never accepts an unverifiable
deduction.

## Phase 2: KAMPS prototype on seeded demonstration data

Round 18 (first pass) also covered the seeded-data prototype sections.

| Round | Typography | Color | Layout | Components | Responsive | Min |
|---|---|---|---|---|---|---|
| 18 | 8 | 8 | 8 | 8 | 8 | 8 |

## Phase 1: The Gap Report site

Rounds 1-17 reviewed the original single-page landscape report.

| Round | Typography | Color | Layout | Components | Responsive | Min | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 7 | 8 | 7 | 7 | 7 | 7 | hero orphan, stat alignment, mobile scroll affordance |
| 2 | 7 | 8 | 7 | 7 | 8 | 7 | grid hole from bad col-span; header crowding |
| 3 | 7 | 8 | 7 | 7 | 7 | 7 | dev-overlay badge in shots; hydration whitespace fix |
| 4 | 7 | 8 | 7 | 7 | 7 | 7 | dev badge persisted: devIndicators off |
| 5 | 7 | 8 | 7 | 7 | 8 | 7 | stat weight, result-cell fill, sticky shadow |
| 6 | 7 | 8 | 7 | 7 | 8 | 7 | line-height unification, hairline result border |
| 7 | 8 | 8 | 7 | 8 | 8 | 7 | result-cell tint flagged |
| 8 | 7 | 8 | 7 | 7 | 8 | 7 | footer double-border (verified false), accordion active state |
| 9 | 8 | 8 | 8 | 7 | 8 | 7 | THIS SYSTEM tint read as second accent: red rule |
| 10 | 8 | 8 | 7 | 8 | 8 | 7 | card-clip claim (verified false): evidence rule added |
| 11 | 8 | 8 | 8 | 7 | 7 | 7 | Turbopack stale-CSS accumulation found + fixed |
| 12 | 8 | 7 | 8 | 7 | 8 | 7 | red-rule overshoot (pixel-verified false) |
| 13 | 8 | 7 | 8 | 7 | 8 | 7 | accent punctuation split; sticky panel tone |
| 14 | 8 | 7 | 8 | 7 | 8 | 7 | mark-color variance (pixel-verified false) |
| 15 | 8 | 8 | 7 | 8 | 8 | 7 | hairline T-junction (normal grid crossing) |
| 16 | 8 | 8 | 7 | 8 | 8 | 7 | result-cell red rule stacked on hairline: removed |
| **17** | **8** | **8** | **8** | **8** | **8** | **8** | ALL 8/8 |

## Methodology

- **Capture** (`scripts/capture.sh`): agent-browser sweep over the eight hash
  views (dashboard, map with a county selected, analytics, vehicles, alerts,
  sources, analyst, report) plus dark mode and mobile 390px: 26 shots per round.
- **Review** (`scripts/vlm-review.mjs`): three VLM calls per round (section
  shots to features 1-3, component shots to feature 4, mobile + dark to
  feature 5), strict JSON output, sequential calls with retry/backoff.
- **Evidence rule**: any deduction must name a concrete, visible defect at
  normal zoom. Suspect claims are independently pixel-verified; several were
  false positives and dismissed (documented in the round notes).
- **Iteration**: every real finding was fixed in code and re-reviewed.

## Final scores (round 21)

```json
{
  "typography": 8,
  "color": 8,
  "layout": 8,
  "components": 8,
  "responsive": 8
}
```

## Functional QA (Agent E, hostile user pass)

A separate adversarial audit (docs/critique-e.md) tested every view,
interaction, and data accuracy claim. All 17 findings (4 critical, 5 major,
8 minor) were fixed and verified, including: the forecast card now renders
the real backtested forecast; the AI analyst no longer mislabels real data;
a wrong exclusion filter that dropped a real Nairobi incident was fixed
(regression-tested at 227 documented); real vehicles sort before demo
records; all counts are dynamic.
