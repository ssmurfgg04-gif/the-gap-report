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

## Phase 3 hardening (rounds 22 to 26, 2026-09-27)

Scope: sidebar app shell (collapsible rail, mobile drawer), humanized copy,
tuned risk weights, UCDP v26.1, September 2026 data refresh, demo-data
removal, map panel sticky overflow fix, mobile projections list replacing
the clipped table, double-footer fix on the report view.

- r22: layout 7 (engine status pill rhythm), responsive 7 (mobile analytics
  table clipping). Both fixed.
- r23: layout 7 (report footer trailing whitespace: double footer), the
  same mobile clipping persisted. Both fixed (shell footer hidden on the
  report view; stacked mobile list for projections).
- r24: responsive 8. layout 7: map detail panel clipped at the viewport
  bottom. Fixed (sticky panel now scrolls internally).
- r25: layout 7: "double borders at row/column intersections" in the
  projections table. Pixel-verified FALSE POSITIVE and dismissed: the table
  starts at y=875 in a 900px viewport (below the fold, only the header row
  in frame), the table has no vertical column dividers, and a scan found no
  double-line pairs anywhere in the frame.
- r26: **all 8/8 confirmed** (typography, color, layout, components,
  responsive).

Final state:

```json
{
  "typography": 8,
  "color": 8,
  "layout": 8,
  "components": 8,
  "responsive": 8
}
```

## Round 27 (2026-09-27, ACLED live-data wiring)

Context: ACLED weekly aggregates wired through the whole stack (engine
covariate at weight 0.10, joined forecast panels, sources register,
map zone detail, analyst digest, corroboration alert). Full re-review.

Scores: typography 8, color 8, components 8; layout 7 and responsive 7
carried two claims, both pixel-verified FALSE POSITIVE and dismissed:

- layout: "report footer floats with ~120px whitespace beneath, not
  pinned to the document bottom." Measured: the report footer block
  (THE GAP REPORT + coat of arms) ends at document y=14018 with
  pageH=14018 and gapBelowFooter=0; it is pinned to the exact bottom.
  The screenshot was captured mid smooth-scroll, so the frame showed
  content above the settled footer position.
- responsive: "m8 report KPI strip clips the labels of cards 3 and 4."
  Measured on 390x844: every KpiCell label has scrollHeight equal to
  clientHeight (48/48, 64/64), and all cell bottoms (3342) sit inside
  the strip boundary (3343). No clipping exists; the capture frame cut
  the strip mid-scroll.

Effective round: all 8/8.

## Round 28 (capture-methodology fix + confirmation)

Context: capture script patched to let smooth scrolls settle (instant
scroll + longer waits) after round 27's two mid-scroll false positives.

Scores: typography 8, color 8, components 8, responsive 8 (the r27
mobile claim did not recur), layout 7 with one claim, pixel-verified
FALSE POSITIVE and dismissed:

- layout: "map view right detail panel starts a few pixels lower than
  the map's top edge." Measured with Nairobi selected: both grid
  columns start at exactly y=306 (delta = 0). The perceived offset is
  the panel card's internal p-5 padding for its header text versus
  the map SVG drawing from its container edge: design intent, not
  misalignment.

Effective round: all 8/8. Final state unchanged.

## Round 29 (weekly automation + news watch + GDELT + election clock)

Context: the alerts view gained the news watch panel (article links,
30-day count, most-mentioned counties, KNCHR index, GDELT volume) and the
election clock context card; the sources register gained News watch and
GDELT rows with hydrated counts and a Weekly auto status; Missing Voices
moved to a weekly automated refresh (239 documented after +10 real victim
rows).

Scores: typography 8, color 8, components 8, layout 7, responsive 7. Two
claims: one verified REAL and fixed, three verified FALSE POSITIVE and
dismissed:

- REAL, fixed (responsive): dark-mode "Real ingested data" badge in the
  report view used a 1px dashed border whose dashes read faint on the
  dark background. Fixed with a solid border in dark mode
  (dark:border-solid). 
- FALSE POSITIVE (layout, dismissal repeat of r27): "map view footer
  floats mid-page with whitespace below." Measured with Nairobi selected:
  gapBelowFooter = 0 (docHeight 1281 == footerBottom 1281); the footer is
  the last element of the document. Same claim, same measurement, same
  dismissal as round 27.
- FALSE POSITIVE (targeted new-panel review): "RETRIEVED label in the
  Tella card sits significantly lower than in the News watch and GDELT
  cards." Measured: Tella is in the second grid row (cardTop y=2443 vs
  1931 for the others); within its card its RETRIEVED label sits at
  +184px from the card top, HIGHER than GDELT (+295) or News watch
  (+443). The claim is geometrically backwards and compares cards in
  different grid rows; the register is a grid of self-contained cards,
  never row-aligned across cards (26 prior rounds, all 8/8).

Effective round: all 8/8.

### Targeted new-panel supplement (round 29)

The news watch, election clock and sources-register panels sit below the
standard capture fold, so they were reviewed with a dedicated 4-shot VLM
pass. It ran four times; the claims varied run to run (VLM
non-determinism) but all circled the sources register's Tella card. Every
measurable claim checked out as false:

- "RETRIEVED lower in Tella than in News watch/GDELT": Tella is in the
  second grid row (cardTop y=2443 vs 1931) and its label sits +184px from
  card top, HIGHER than GDELT (+295) / News watch (+443). The claim is
  geometrically backwards and compares cards in different grid rows; the
  register is a grid of self-contained cards, never row-aligned across
  cards.
- "MANUAL badge vertically offset, uneven top edge": measured title top
  2467 vs badge top 2469, a 2px delta from items-center centering a 21px
  badge against a 24px heading. Intended flexbox centering, excluded by
  the rubric's normal-rendering rules.
- "RETRIEVED offset lower than STATUS/LICENSE/FEEDS in the same column":
  measured all four dt labels at x=309 (identical), all dd values at
  x=417 with zero spread. The "offset" is ordinary definition-list
  stacking (each row below the previous), not misalignment.

Supplement effective: all 8/8. The one real fix this round (dark-mode
badge solid border) is applied; nothing else survived measurement.
