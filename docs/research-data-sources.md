# KAMPS data-source research log

Deep research pass, 2026-09-28: what we hunted for beyond the two pending
items (ReliefWeb appname, ACLED event-level tier), what we adopted, what we
rejected and why. Every claim below was verified by actually hitting the
source (curl probes, real downloads, parsed rows), not by reading about it.

## What we were hunting for

Three gaps in the system, in priority order:

1. **Fresh discovery.** The curated incident file updates when a human adds
   a row. Everything else (ACLED weekly, Missing Voices monthly) lags days
   to weeks. We needed a same-week signal that says "something happened,
   go verify".
2. **Independent corroboration.** Missing Voices is civil society, ACLED is
   conflict-coded. A third, structurally different series makes the trend
   picture harder to argue with.
3. **Automation.** Any source that needs a human to remember it will
   eventually go stale. Weekly data deserves a weekly pipeline.

## Adopted this round

### News watch (Google News RSS + Bing News RSS + KNCHR statement index)

Keyless, free, same-week. Google News RSS search returns 100 items per
query with publication dates and source attribution; Bing News RSS is an
independent second index; KNCHR's article index is a DNN site whose
statement ids make new-statement detection trivial (latest id observed:
1265). Deduplicated by normalized title, keyword-matched against the
abduction vocabulary, counties matched from headlines with strict
word-boundary regexes (the naive substring matcher matched "Eastleigh
Voice" as the town Voi; the strict matcher fixed it).

What it feeds: the news watch panel on the alerts view, the coverage-surge
alert, the curator queue in the weekly digest issue (candidates for
promotion into the documented incident file), and the KNCHR new-statement
flag. First live sweep found fresh September cases the curated file does
not yet carry (Muteti Mulinge found dumped in Lukenya, Collins Otieno
found along Thika Road).

Deliberate boundary: this is a discovery layer, not an incident list. A
matched headline never counts as an incident until a human verifies it
against a second source and promotes it with its source URL. Automation
surfaces; humans verify. That division is the honest design.

### GDELT DOC 2.0 API (media volume)

Keyless, 15-minute global news index. mode=TimelineVolRaw returns raw
article counts per day; query "kenya (abduction OR abducted OR kidnapped
OR "enforced disappearance") sourcelang:eng" gives a 12-month series
(349 daily points at adoption, 43 articles in 2026-09). The API rate
limits hard (one request per 5 seconds, aggressive against datacenter
IPs), so the ingest script retries patiently, falls back to a simpler
known-good query, and preserves the last successful timeline on failure.

What it feeds: the GDELT volume readout on the alerts view and the analyst
digest, as context only.

Deliberate boundary: media attention is not incidence. Language bias,
press freedom and news cycles move this series. It sits next to the
civil-society and conflict-coded counts, and it is structurally excluded
from the risk index. Adding it to the index would let media cycles leak
into "risk", which is exactly the slop a bias-corrected instrument exists
to avoid.

### Missing Voices weekly refresh

The tier-1 series, now automated (scripts/ingest-missingvoices.mjs): the
rolling monthly Highcharts series on /statistics overlays the stored
months, and the newest ~210 victim rows are re-pulled with polite delays.
Historical months stay frozen as first scraped. The merge is faithful:
this week's refresh changed zero stored months and added 10 real new
victim rows (July-August 2026 police-shooting cases, site-published).

### Election calendar context

Kenya's general elections fall on the second Tuesday of August every five
years (2022-08-09, next 2027-08-10). The documented record gives the
run-up weight: 2021, the year before the last general election, was
Missing Voices' highest yearly total on record (219 cases). The engine
now surfaces an election clock (11 months out at adoption) with that
fact attached, framed as a planning input, not a prediction.

### Weekly GitHub Action pipeline

`.github/workflows/weekly-ingest.yml`, Tuesdays 04:30 UTC (after ACLED's
Monday file): pull ACLED + GDELT + news watch + Missing Voices (+ ReliefWeb
when the appname clears), run the engine regression guard in CI mode
(structural checks, since counts legitimately shift weekly), generate the
weekly digest, commit changed data, and file the digest as an issue labeled
weekly-digest. Every week leaves a permanent, searchable record, and the
repo's git history becomes the data archive. ACLED credentials are set as
repo secrets; the workflow uses the built-in GITHUB_TOKEN, so no
credentials live in code.

## Evaluated and rejected (with reasons)

| Source | Verdict | Why |
|---|---|---|
| UCDP Candidate GED v26.0.8 | rejected | Continuously updated, but only 2 Kenya rows in 2026: the dataset's organized-violence definition (fatalities-based, annual thresholds) structurally excludes abduction patterns. ACLED weekly aggregates already cover 2023-2026 better. |
| IOM DTM Kenya (HDX) | rejected | Live on HDX (checked 2026-09-21 update) but latest site assessment is Dec 2024, 11 counties, drought-driven displacement in ASAL counties. Wrong phenomenon, wrong geography, stale cadence. |
| NetBlocks / Cloudflare Radar | rejected | Real signal (Kenya has had throttling during protests) but no stable free API; scraping their pages is fragile and unverifiable. Revisit if Cloudflare Radar's free tier opens up. |
| World Bank CPI / food prices | rejected | Annual-to-quarterly cadence at the API level for Kenya food CPI, far too coarse for a weekly system. KNBS monthly PDFs are not machine-readable. |
| ViEWS (Uppsala) | rejected | Country-month conflict forecasts exist, but Kenya is not a priority country in their released forecasts and the API contract is unstable for a weekly production feed. |
| ACLED CAST forecasts | rejected | Conflict-escalation forecasts, not disappearance monitoring; wrong target variable for this niche. |
| X/Twitter API | rejected | Paid tier for search; no free path. Nitter is dead. |
| Telegram channels | rejected | Public t.me/s previews of Kenyan human-rights channels are scrapeable but unverified and fragile; the ethics rules here (no unverified individuals) make raw social content a liability, not an asset. |
| Wayback CDX API | rejected | Useful for historical recovery, not weekly monitoring. No new information at weekly cadence. |
| Google News via full scrape | rejected (RSS adopted instead) | The RSS endpoints are the sanctioned, stable, parseable surface of the same index. |

## Still pending

- **ReliefWeb v2** — appname requested 2026-09-27 (kamps-earlywarning-7f3a),
  review up to two business days. The weekly action picks it up the moment
  RELIEWEB_APPNAME is set as a repo secret. (The temp inbox used for the
  request could not be rechecked this session; if the approval mail is lost,
  re-file the form with a durable contact.)
- **ACLED event-level REST** — unlocks at Research Partner tier; the ingest
  script probes it every run and switches over with zero changes.
- **Police occurrence-book / mortuary / IPOA lists** — Access to Information
  Act 2016 filings, the third and fourth lists that would make
  capture-recapture estimable. No API exists; this is a legal process.

## Ranked future opportunities

1. **Alert delivery beyond the repo** — the digest issue is readable by any
   GitHub user; the next step is a webhook to a Signal/Matrix bridge or an
   RSS file in the repo that partners can subscribe to. Zero new data
   sources, big usability gain.
2. **Per-county news watch queries** — Google News RSS supports
   site-agnostic keyword search; adding county-specific query terms
   (currently the county signal comes from headline geolocation) would
   widen the local coverage net.
3. **GDELT artlist as a second discovery feed** — mode=ArtList returns the
   article list behind the volume timeline; folding it into the news watch
   would add a third independent index for deduplication.
4. **UCDP GED yearly upgrade watch** — v27.1 lands with 2026 full-year
   coverage; a yearly action bump is a two-line change.
5. **IPOA quarterly report scraping** — published PDFs with case counts;
   low cadence but high authority for the data-layer alert.
