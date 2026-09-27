# KAMPS · Kenya Abduction Monitoring & Prediction System

A working early-warning instrument for enforced disappearances in Kenya,
built as a single-page application: real ingested data, a six-stage
bias-corrected statistical engine, a walk-forward backtested forecast, an
interactive 47-county risk map, a data-grounded AI analyst, and
aggregate-only protective alerts. The original Gap Report landscape analysis
("who else is doing this?") is embedded as the Report view.

## The application

Eight hash-routed views on `/`:

- **Dashboard** — KPI strip with count-up animation, live engine status, pipeline
  stage chips, top-risk counties, recent alerts, 60s auto-refresh
- **Risk Map** — interactive choropleth of all 47 counties (IEBC boundaries):
  hover tooltips, click-to-select with a full zone assessment panel, zoom/pan,
  keyboard operable, honest gray no-data rendering
- **Analytics** — the statistical core on the working surface: national
  forecast chart with 95% prediction bands, walk-forward backtest metrics
  (AUC, Brier, coverage), two-list capture-recapture Venn and estimator
  status, county burden table on census denominators, 47-county risk table
- **Vehicles** — the four-zone rule spec, real publicly documented pattern
  vehicles with source links first, clearly labeled demonstration records
  with sighting timelines
- **Alerts** — severity-ordered protective messaging: zone bands, spatial
  clusters, vehicle patterns, temporal anomalies, data-layer status
- **Sources** — the provenance register: tier, connection status, license,
  real row counts, honest failure records
- **Analyst** — AI Q&A grounded strictly in the live analysis digest
  (server-side, rate-limited, refuses speculation about individuals)
- **Report** — the full Gap Report: hero, the field of eight organizations,
  the capability matrix, why nobody has built this, the KAMPS blueprint
  (architecture, data tiers, six-stage pipeline, safeguards, roadmap),
  the live model section, outlook, verdict, and the footer with the Kenya
  coat of arms

## Real data (no seeded or placeholder rows)

| Dataset | Rows | Source |
|---|---|---|
| Documented incidents | 227 in window (2024-06 to 2026-08) | Missing Voices victims (200) + curated public record (27), entity-resolution deduplicated |
| County denominators | 47 counties, sum exactly 47,564,296 | KNBS 2019 census (via Wikipedia compilation) |
| Organized-violence events | 1,126 events, 1989-2022 | UCDP GED v23.1 (CC BY 4.0), county-assigned by point-in-polygon |
| Monthly series | 2020-2026 enforced-disappearance and killing counts | Missing Voices statistics pages |
| County geometry | 47 polygons | IEBC boundaries (open data compilation) |
| Vehicle patterns | 2 real documented + 3 labeled demo | BBC News, Capital FM Kenya, public statements |

Every file traces to a fetched source URL; failures (ReliefWeb 403, ACLED
key-gated) are recorded as failures in `data/manifest.json` and surfaced in
the Sources view. The only synthetic rows are vehicle demonstration records,
marked DEMO everywhere they appear.

## The engine (`src/lib/kamps/`)

1. **Crude rates** on real census denominators
2. **Empirical Bayes** Poisson-Gamma smoothing (Marshall global prior)
3. **Multiple Systems Estimation** — two-list capture-recapture with Jaro-Winkler
   entity resolution; honestly reports "not estimable" while the lists do not
   overlap (occurrence-book and mortuary lists are pending ATI requests)
4. **Spatial scan statistic** — variable-circle Kulldorff scan, 999 Monte Carlo
   replications, population-conditioned
5. **Temporal anomaly detection** — trailing 12-month baselines on the real
   monthly series (flagged the actual June 2026 spike at +14.5 sigma)
6. **Composite risk index** — weighted, documented, confidence-graded

Plus: **forecast** (Holt-Winters seasonal 12 on the national series;
walk-forward-backtested logistic classifier on UCDP county-month panels),
**four-zone vehicle rule**, and the **alert layer** (aggregate zone-level
output only, never individuals: the system exists to protect people, not to
predict them).

## Design system

Swiss minimalism: near-black on white, one red accent, Geist Sans + Geist
Mono, hairline borders, tabular numerals, no em dashes in UI text. Brand
assets: `public/logo.svg`, app favicon, and the Kenya coat of arms (public
domain, displayed unmodified with credit). Dark mode via next-themes.

## Quality

- **21 VLM design review rounds** to all 8/8 (5 features; evidence-based
  rubric; suspect claims pixel-verified and dismissed when false) —
  history in `docs/reviews/SCORES.md`
- **Hostile-user functional audit** (Agent E): all 17 findings fixed and
  re-verified, including a regression test that guards the documented count
  (227) — `docs/critique-e.md`
- Data accuracy cross-checked against raw files (population sum, county
  counts, monthly series, incident window)

## Run it

```bash
bun install
bun run dev   # http://localhost:3000
```

The engine reads `data/` at runtime; the API is `GET /api/kamps` and
`POST /api/kamps/analyst`.
