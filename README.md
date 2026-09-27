# KAMPS · Kenya Abduction Monitoring & Prediction System

A working early-warning instrument for enforced disappearances in Kenya,
built as a single-page application: real ingested data, a six-stage
bias-corrected statistical engine, a walk-forward backtested forecast, an
interactive 47-county risk map, a data-grounded AI analyst, and
aggregate-only protective alerts. The original Gap Report landscape analysis
("who else is doing this?") is embedded as the Report view.

[![Weekly data pipeline](https://github.com/ssmurfgg04-gif/the-gap-report/actions/workflows/weekly-ingest.yml/badge.svg)](https://github.com/ssmurfgg04-gif/the-gap-report/actions/workflows/weekly-ingest.yml)

**Data current through:**<!-- data-freshness --> ACLED weekly file through
2026-09-12; Missing Voices and the news watch auto-refresh every Tuesday
<!-- /data-freshness -->

## The application

A left sidebar keeps the interface to what you came for. Three groups match
the three reasons people open KAMPS: watch what is happening, investigate
what it means, or read where the numbers come from. The sidebar collapses
to an icon rail on desktop and slides over as a drawer on mobile.

**Watch**
- **Dashboard** — the count, corrected: one headline number, the undercount
  state, bias-adjusted top zones, latest signals, engine status, 60s
  auto-refresh
- **Risk map** — interactive choropleth of all 47 counties (IEBC
  boundaries): hover tooltips, click-to-select with a full zone assessment
  panel, zoom/pan, keyboard operable, honest gray no-data rendering
- **Alerts** — severity-ordered protective messaging: zone bands, spatial
  clusters, vehicle patterns, temporal anomalies, data-layer status, plus
  the news watch panel (weekly discovery sweep with a verification
  boundary) and the election clock (2027 run-up context from the
  documented record)

**Investigate**
- **Analyst** — AI Q&A grounded strictly in the live analysis digest
  (server-side, rate-limited, refuses speculation about individuals)
- **Vehicles** — the four-zone rule spec plus every publicly documented
  pattern vehicle with source links and sighting timelines; zero demo rows
- **Analytics** — the statistical core: national forecast chart with 95%
  prediction bands, walk-forward backtest metrics (AUC, Brier, coverage),
  two-list capture-recapture Venn and estimator status, county burden
  table, 47-county risk table

**Reference**
- **Sources** — the provenance register: tier, connection status, license,
  real row counts, honest failure records, and what is blocking each
  missing feed
- **Report** — the full Gap Report: hero, the field of eight organizations,
  the capability matrix, why nobody has built this, the KAMPS blueprint,
  the live model section, outlook, verdict, and the Kenya coat of arms

## Real data (no seeded or placeholder rows)

| Dataset | Rows | Source |
|---|---|---|
| Documented incidents | 239 in window (2024-06 to 2026-09) | Missing Voices victims (210) + curated public record (31) + KNCHR statements, entity-resolution deduplicated |
| County denominators | 47 counties, sum exactly 47,564,296 | KNBS 2019 census (via Wikipedia compilation) |
| Organized-violence events | 1,246 events, 1989-2025 | UCDP GED v26.1 (CC BY 4.0), county-assigned by point-in-polygon |
| ACLED weekly aggregates | 17,193 county-week rows, 1997 to week of 2026-09-12, all 47 counties | ACLED Africa aggregated file (myACLED Open tier, OAuth login verified), auto-pulled weekly |
| Monthly series | 2020-2026 enforced-disappearance and killing counts | Missing Voices statistics pages, auto-refreshed weekly |
| News watch | 54 keyword-matched articles (trailing 60 days), 10 in the last 7 days | Google News RSS, Bing News RSS, KNCHR statement index (keyless, weekly) |
| GDELT media volume | 349 daily points, 12 months (43 articles in 2026-09) | GDELT DOC 2.0 API, mode=TimelineVolRaw (keyless, weekly) |
| County geometry | 47 polygons | IEBC boundaries (open data compilation) |
| Vehicle patterns | 3 real documented, zero demo rows | BBC News, Capital FM Kenya, KNCHR (June 2026 Subaru pattern) |

Every file traces to a fetched source URL; failures (ReliefWeb appname
pending) are recorded as failures in `data/manifest.json` and surfaced in
the Sources view. Zero synthetic rows anywhere. What we evaluated and
rejected on the way (UCDP Candidate, IOM DTM, NetBlocks, World Bank CPI,
ViEWS, Telegram and more) is documented with reasons in
`docs/research-data-sources.md`.

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
6. **Composite risk index** — weights calibrated by walk-forward validation
   (`scripts/calibrate-weights.ts`): the ACLED trailing-12-month corroboration
   took the 0.10 slot from the stale UCDP 2013-2022 prior (AUC 0.694/0.590
   before, 0.681/0.608 after, with the win on the longer 15-month fold),
   documented in `src/lib/kamps/stats.ts`

Plus: **forecast** (Holt-Winters seasonal 12 on the national series;
walk-forward-backtested logistic classifier on UCDP 2010-2022 joined to
ACLED 2023-2026 county-month panels: backtest AUC 0.753, 1,939 walk-forward
predictions), **four-zone vehicle rule**, and the **alert layer**
(aggregate zone-level output only, never individuals: the system exists to
protect people, not to predict them).

## Design system

Swiss minimalism: near-black on white, one red accent, Geist Sans + Geist
Mono, hairline borders, tabular numerals, no em dashes in UI text. Brand
assets: `public/logo.svg`, app favicon, and the Kenya coat of arms (public
domain, displayed unmodified with credit). Dark mode via next-themes.

## Quality

- **26 VLM design review rounds**, all 8/8 (5 features; evidence-based
  rubric; suspect claims pixel-verified and dismissed when false, e.g. the
  r25 "double border" claim whose table sits below the fold) — history in
  `docs/reviews/SCORES.md`
- **Hostile-user functional audit** (Agent E): all 17 findings fixed and
  re-verified, including a regression test that guards the documented count
  (239 after the 2026-09-28 weekly refresh; structural checks in CI mode) —
  `docs/critique-e.md`
- Data accuracy cross-checked against raw files (population sum, county
  counts, monthly series, incident window)

## Run it

```bash
bun install
bun run dev   # http://localhost:3000
```

The engine reads `data/` at runtime; the API is `GET /api/kamps` and
`POST /api/kamps/analyst`.

## Weekly automation (the pipeline runs itself)

`.github/workflows/weekly-ingest.yml` runs every **Tuesday 04:30 UTC**
(07:30 Nairobi, after ACLED's Monday file refresh) and can be triggered
manually from the Actions tab:

1. **Pull** — ACLED weekly aggregates (OAuth with the repo secrets), GDELT
   media volume, the news watch sweep (Google News + Bing News + KNCHR
   index), the Missing Voices refresh, and ReliefWeb once its appname
   clears. Each feed degrades gracefully; a blocked feed never blocks the
   run.
2. **Guard** — the engine must run clean over the fresh data
   (`KAMPS_CI=1 bun scripts/test-engine.ts`: structural checks, because
   documented counts legitimately move every week). Bad data never lands.
3. **Commit** — changed files under `data/` are committed by `kamps-bot`
   with the README data-freshness marker updated, so the git history is
   the data archive.
4. **File the digest** — a weekly digest issue (label `weekly-digest`)
   with the numbers, the week-over-week deltas, action-level alerts, and
   the curator queue: fresh discovery candidates that a human verifies
   against a second source before promotion into the documented incident
   file. Automation surfaces, humans verify. That boundary is the design.

The repository secrets (`ACLED_EMAIL`, `ACLED_PASSWORD`) are set; the
workflow authenticates with the built-in `GITHUB_TOKEN`, so no credentials
live in code or logs.

## Wiring the remaining data feeds

- **ACLED** — live and wired (2026-09-27), auto-pulled weekly. The myACLED
  account authenticates via OAuth (verified: token issued, uid 223950), and
  the weekly Africa aggregated file feeds the engine through the week of
  2026-09-12: 17,193 Kenya county-week rows, all 47 counties, 299
  abduction-coded county-weeks. Refresh any time:
  `ACLED_EMAIL=... ACLED_PASSWORD=... node scripts/ingest-acled.mjs` (the
  script tries the event-level REST API first and falls back to the
  aggregate file; from datacenter IPs it routes via a CORS relay
  automatically, elsewhere it goes direct). Event-level REST (per-incident
  rows, actor fields, notes) unlocks at Research Partner tier — the ingest
  probes it on every run and will switch over with zero changes when the
  tier clears.
- **ReliefWeb** — appname requested 2026-09-27 through the official form
  (review up to two business days). When approval arrives, set the
  `RELIEFWEB_APPNAME` repo secret and the weekly action picks it up
  automatically, or run `RELIEFWEB_APPNAME=... node scripts/ingest-reliefweb.mjs`.
- **What else we evaluated** (and why it did not make the cut):
  `docs/research-data-sources.md` is the full research log, adopted and
  rejected sources with reasons.

The police occurrence-book, mortuary, and IPOA lists that would make
capture-recapture fully estimable require Access to Information Act 2016
filings, per the implementation plan.
