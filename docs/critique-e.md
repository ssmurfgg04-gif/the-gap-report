# KAMPS ultra-critical QA audit (Agent E, hostile user pass)

Scope: every hash view (`#view=dashboard|map|analytics|vehicles|alerts|sources|analyst|report`), desktop 1280x800 and mobile 390x844, light + dark, API + raw-data cross-checks. Dev server at http://localhost:3000 was used as-is (never restarted). Evidence screenshots live in `screenshots/critique/`. Commands quoted are the exact ones used.

What already works well (verified, so it does not need to be re-audited): all 8 views render within ~1-3s with **zero console errors or page errors** (`agent-browser console` / `agent-browser errors` after cycling all views); dashboard KPIs 226 / 226 / 1 / 2 and top-5 zones exactly match `/api/kamps` (documentedTotal 226, estimatedTotal 226, significantClusters 1, flaggedVehicles 2, highestZone Nairobi 84.5, Kiambu 76.4, Kajiado 73.1, Laikipia 69.5, Kirinyaga 63.1); "DATA AS OF 2026-08-31" shown; 60s auto-refresh and REFRESH NOW do not flash or reset the count-ups (sampled the KPI 20x at 60ms after clicking refresh: constant "226"); the six pipeline stages render (CRUDE RATES, EB SMOOTHING, MSE, SPATIAL SCAN, TEMPORAL ANOMALY, COMPOSITE INDEX). Risk map: 47 county paths, hover tooltip (county + region + index/100 + band + documented + pop), click opens the full zone assessment (Nairobi: 52 documented, pop 4,397,073, EB 1.1 CI 0.8-1.4, MSE 52 x1.00, cluster RR 8.64 p=0.001, +0.4 sigma, vehicle signal; all matching the API), `aria-pressed=true` + stroke/width 2/opacity 1 on selection, zoom in 1.5x/2.25x, zoom out, reset, drag-pan works once zoomed, keyboard focus + Enter selects (Baringo verified, tooltip appears on focus too), legend 5 bands. Analytics: Venn 2 circles MV/NEWS 200/0/4, validation card AUC 0.648 / Brier 0.129 / 0.9% false alarms / 97% PI coverage / 130 predictions, county burden table 26 rows with census populations, RiskPanel 47 rows sorted desc. Vehicles: source hrefs non-empty (BBC article, Capital FM article), demo cards carry DEMO badge + "DEMONSTRATION RECORD" text, timeline dots match sighting counts (6/5/2/2). Alerts: severity order critical > elevated > watch > info, all 24 have DRIVERS and RECOMMENDED PROTOCOL, temporal anomaly 2026-06 exists ("+14.5 sigma, 15 vs 0.5 baseline"). Sources: 8 sources, 5 CONNECTED with real row counts (200 victims, 29 incidents, 47,564,296 census total, 1,126 UCDP events, 47 polygons), 2 SANDBOX-BLOCKED (ReliefWeb 403, ACLED key), 1 MANUAL (Tella Phase 3). Analyst: answers in 1.6-2.3s (< 15s), empty question leaves ASK disabled (safe), rate limit 10/min enforced (429 on the 9th rapid request after 2 earlier) and the UI shows a graceful "ANALYST UNAVAILABLE ... 429" card. Report: all sections render (hero/field/matrix/analysis/system/model/outlook/verdict + footer), coat-of-arms `img[src="/kenya-coat-arms.svg"]` loads (naturalWidth 738; `curl` 200), "REAL INGESTED DATA" chip present, `#model` tabs switch with real content. `/logo.svg` 200 and rendered in the shell; `/icon.svg` 200 and `src/app/icon.svg` exists. Mobile 390x844: `document.scrollingElement.scrollWidth === 390` on **every** view (no horizontal overflow), nav scrolls horizontally (724px > 390px), KPI cards stack full-width, county chip buttons 44px tall. Dark mode: body inverts to lab(1.98) bg / lab(95.36) fg, map fills adjust, no dark-on-dark text found (0 suspicious elements). No U+2014 em dash anywhere in `document.body.textContent` or the tab title across all 8 views, including rendered analyst answers. A11y: every view has an h1; nav uses `aria-current="page"`; map counties are focusable `role=button` with Enter/Space handlers; analyst textarea has a `<label for="analyst-question">`. Performance: `/api/kamps` 8-13ms, page 31ms, analyst POST 2.25s. Raw-data recompute: 47 counties summing to 47,564,296, Nairobi 4,397,073, highest zone index 84.5 (Nairobi), temporal 2026-06 ed=15, 200 MV victims all dated inside the 2024-06-01..2026-08-31 window, 26 kept public-record incidents, 0 ER matches, unlocated 34 (33 null MV locations + 1 "Nrb, Kangemi") = documentedTotal 226 (matches the API).

---

## CRITICAL

### C1. Analytics ForecastCard renders a fake "engine warming up" placeholder while the API serves a real, backtested forecast
- **What I did:** `agent-browser open http://localhost:3000/#view=analytics`, then `agent-browser eval "document.querySelector('main').innerText.slice(0,3000)"`.
- **What I observed:** first card reads "FORECAST / ENGINE WARMING UP / The projection model is not deployed yet. When it is wired to the warehouse it will publish 90-day projected indices per zone ..." plus skeleton bars. Evidence: `screenshots/critique/07-analytics-top.png`.
- **What the API actually returns:** `curl -s http://localhost:3000/api/kamps` shows `forecast.projections` = **12 rows** (Nairobi 84.5 -> 89.3 projected, band critical, trend +1.4 ...), `forecast.national` = 3-month national forecast with 95% PIs (2026-09 mean 1.9 PI 0-8.8 ...), `forecast.backtest` = AUC 0.648, Brier 0.129, method "Holt-Winters (seasonal 12, grid-searched) ... walk-forward backtested UCDP GED panels".
- **Root cause (code):** `src/components/app/views/analytics.tsx:142` hardcodes `<ForecastCard forecast={null} />`. The component below it (lines 62-116) already renders a perfect current-vs-projected table when given a payload; the view never passes `kamps.analysis.forecast`. The forecast's national series/PIs are shown nowhere else in the app either (grep: `forecast` only consumed by `bias-panel.tsx` for backtest metrics).
- **Severity: CRITICAL.** The system's headline prediction capability is computed, validated, served, and then hidden behind a "not deployed" lie. A user trusting the "not deployed" note would conclude the P in "Monitoring & Prediction System" is missing.
- **Fix:** pass the real payload: in `AnalyticsBody`, replace `<ForecastCard forecast={null} />` with `<ForecastCard forecast={analysis.forecast} />` (types already align; `ZoneForecast` lacks the optional `trend` field, add it). Also render the national 3-month series with PIs (e.g. a small chart or table above the zone projections) and keep the honest caveat text about UCDP-trained county trend factors.

### C2. The AI analyst tells users the real data is "a simulated demonstration dataset"
- **What I did:** `curl -s -X POST http://localhost:3000/api/kamps/analyst -H 'Content-Type: application/json' -d '{"question":"What is the estimated true total of incidents and how was it computed?"}'`.
- **What I observed (exact answer excerpt):** "The estimated true total of incidents is 226 with a 95% confidence interval of 226 to 316, **based on a simulated demonstration dataset**. ..." The numbers are right; the provenance claim is false. The app everywhere else says "REAL INGESTED DATA" (report `#model` chip, sources register, API digest line "Data: REAL ingested datasets ...").
- **Root cause (code):** `src/app/api/kamps/analyst/route.ts:147`, SYSTEM_PROMPT rule 7: "All figures come from a simulated demonstration dataset; say so when quoting totals or estimates." This is a stale demo-phase instruction that now forces the model to bad-mouth real data. The digest sent in the same request says the opposite ("REAL ingested datasets"), so the model gets contradictory instructions.
- **Severity: CRITICAL.** This is the single worst trust failure in the app: the AI layer actively denies the system's realness. Anyone fact-checking via the analyst concludes the whole platform is fake.
- **Fix:** delete rule 7 and replace with: "All figures come from real ingested datasets (Missing Voices, curated public-record incidents, KNBS 2019 census, UCDP GED); say so when quoting totals or estimates. The only synthetic rows are vehicle demonstration records, which are labeled DEMO in the digest."

### C3. `isOutsideKenya()` drops a real Nairobi incident because its location string contains the word "outside"
- **What I did:** recomputed `documentedTotal` from the raw files with python3 (`data/missing-voices.json`, `data/incidents-public-record.json`, replicating `mapToCounty`/`isOutsideKenya`), and cross-checked with `curl -s http://localhost:3000/api/kamps`.
- **What I observed:** of the 29 public-record incidents, three are filtered out as "outside Kenya": "Bob Njagi (Uganda abduction) | Kireka, Uganda" (correct), "Nicholas Oyoo | Kireka, Uganda" (correct), and **"Six unnamed June 25 anniversary protesters | Nairobi (outside Parliament)" (WRONG: this is a Nairobi, Kenya incident; the word "outside" refers to Parliament)**. Result: documentedTotal = 200 + 26 = 226. It should be 200 + 27 = **227** for that in-window, Kenya-located, sourced incident (The Standard/AFP source URL present).
- **Root cause (code):** `src/lib/kamps/real-data.ts:109-113`: `isOutsideKenya` returns true if the location contains "uganda", "tanzania", **or the bare word "outside"**. "Nairobi (outside Parliament)" trips it. Verified against the engine path (`loadPublicRecordIncidents` filters `.filter(r => !isOutsideKenya(r.location))`).
- **Severity: CRITICAL.** A data-accuracy bug in the core documented count: a real abduction incident (six people) silently vanishes from the warehouse, the county counts, and every downstream statistic. For a system whose entire pitch is accurate counting, silently dropping a real incident because of a substring match is disqualifying.
- **Fix:** match "outside Kenya", "outside the country", country names, and specific foreign towns (Kampala, Kireka, etc.), not the bare word "outside". Add a regression test with the exact string "Nairobi (outside Parliament)" asserting it is kept, and assert documentedTotal === 227.

### C4. Vehicles view lists DEMO vehicles before the real documented ones, contradicting its own intro text
- **What I did:** `agent-browser open http://localhost:3000/#view=vehicles` then dumped `document.querySelector('main').innerText` (evidence: `screenshots/critique/08-vehicles.png`).
- **What I observed, in order:** (1) "Silver Subaru Forester | PLATE PARTIAL KDG 4·7B | **DEMO**", (2) "White Subaru Legacy | KCX 9·1Y | **DEMO**", (3) "Silver Subaru Forester | KDG 8·3B | DOCUMENTED" (the real BBC/Capital FM Koimburi vehicle), (4) "White Subaru Legacy | unmarked | DOCUMENTED". Meanwhile the intro paragraph on the same screen says: "The **first cards below are real**, publicly documented pattern vehicles with their sources." That sentence is false as rendered.
- **Root cause (code):** the API returns vehicles in engine order (`src/lib/kamps/vehicle.ts:150-152`: flagged first, then monitoring, then cleared, by confidence desc). The demo records are "flagged" (0.91/0.84 confidence, synthetic sighting logs designed to trip the rule), so they outrank the real "monitoring" vehicles (0.65/0.55). The raw file `data/vehicles-public-record.json` actually lists R1, R2 (real) before D1, D2 (demo). The view (`src/components/app/views/vehicles.tsx`) renders API order and its copy (`views/vehicles.tsx`, intro paragraph) promises real-first.
- **Severity: CRITICAL.** The one place a field monitor looks for real, actionable vehicle patterns is led by synthetic records, and the copy that is supposed to orient them lies about the order. Demo-first is exactly the "not a production system" smell this audit is meant to catch.
- **Fix:** sort real (`simulated: false`) before demo within the view (or in the API): primary key `v.simulated ? 1 : 0`, then status order, then confidence. Update the intro copy to match whatever ordering is chosen.

---

## MAJOR

### M1. Sources view "Honesty note" claims the engine "runs a seeded demonstration warehouse" and that row counts need an undeployed endpoint
- **What I did:** `agent-browser open http://localhost:3000/#view=sources`, dumped the view text (evidence: `screenshots/critique/10-sources.png`).
- **What I observed:** the boxed note at the top reads "Row counts, retrieval logs, and per-source volumes are published only through a live sources endpoint, which is not deployed yet. Until it exists this register lists provenance and access state, never invented numbers. **The engine currently runs a seeded demonstration warehouse.**" Both claims are false on the same screen: the register right below lists real row counts (200 victim records, 29 incidents, 47 county populations summing exactly to 47,564,296, 1,126 UCDP events, 47 polygons), and the engine runs the real ingested files (`simulated: false` in `/api/kamps`, "REAL INGESTED DATA" chip in the report).
- **Root cause (code):** `src/components/app/views/sources.tsx:143-148`, stale hardcoded copy from the pre-ingestion phase.
- **Severity: MAJOR.** An "honesty note" that lies is worse than no note. It directly contradicts the API and the rest of the app, and it undersells the system to exactly the audience (auditors, partners) who will read it.
- **Fix:** rewrite the note to state the truth: row counts come from `data/manifest.json` (retrieved_at, quality flags, documented failures); per-source retrieval logs and a live `/api/kamps/sources` endpoint remain roadmap items. Delete the "seeded demonstration warehouse" sentence.

### M2. Report footer says the engine does "a live simulated run"
- **What I did:** scrolled the report view to the footer; `agent-browser eval "document.querySelector('footer').innerText"`.
- **What I observed:** "THE GAP REPORT ... with the KAMPS specification and **a live simulated run** of its statistical engine." The same document's `#model` section says "Real data. Real statistics. ... runs the six-stage pipeline against the ingested real datasets" with a "REAL INGESTED DATA" chip.
- **Root cause (code):** `src/components/site/verdict.tsx:117`, stale copy.
- **Severity: MAJOR.** The closing statement of the whole report misdescribes the system's data as simulated; anyone quoting the verdict will spread the wrong claim.
- **Fix:** change to "a live run of its statistical engine against real ingested datasets" (or similar).

### M3. "All twelve zones" label over a 47-row table (and "twelve sub-county markers" aria-label)
- **What I did:** in the report view, `agent-browser eval` on `#model`: the table caption "Zone risk assessment table, ranked by composite index" has `tbody tr` length **47**, while the heading above it reads "ALL TWELVE ZONES, RANKED BY COMPOSITE INDEX". Same stale "twelve" in the report map's aria-label.
- **Root cause (code):** `src/components/site/kamps/risk-panel.tsx:58` ("All twelve zones, ranked by composite index") and `src/components/site/kamps/kenya-map.tsx:39` (aria-label "Kenya risk map: twelve sub-county markers ..."). Both render under the live analysis (47 zones).
- **Severity: MAJOR.** A count in the UI that contradicts the table directly under it is a factual error in rendered text. Screen-reader users get the wrong count via the aria-label too.
- **Fix:** make both dynamic: `All ${analysis.zones.length} zones, ranked by composite index` and `aria-label={`Kenya risk map: ${zones.length} sub-county markers ...`}`.

### M4. The "DATA LAYER · underreporting estimate updated" alert describes a 3-list log-linear estimate that never ran
- **What I did:** read the alerts view text (`screenshots/critique/09-alerts.png`) and the API alert.
- **What I observed:** the alert says "Multiple Systems Estimation **across three capture lists** estimates 226 total incidents against 226 documented, an underreporting factor of 1.00x ... the estimation method is the same one HRDAG applied to conflict mortality records" and its drivers say "**3-list capture-recapture, log-linear estimator, 400 bootstrap replications**". Reality per the same API: `mse.method = "not-estimable"`, two live lists (MV 200, news 4), overlap 0, note "Capture-recapture requires overlap to estimate the unseen ... the documented count stands unadjusted."
- **Root cause (code):** `src/lib/kamps/alerts.ts:147-168` (`dataAlert`), static text written for the old simulated 3-list build.
- **Severity: MAJOR.** The alert feed's data-quality message contradicts the analytics MSE panel and overstates methodology (no log-linear estimator, no bootstrap ran on the live lists). For a system selling statistical honesty, this alert is the kind of thing that gets quoted back at you.
- **Fix:** generate the message from `mse`: when method is "not-estimable", say exactly that ("Two live lists with zero matched overlap; no underreporting adjustment applied. The documented count stands at 226 (transparency interval 226 to 316). Police occurrence-book and mortuary lists are pending Access to Information requests.") and drop the log-linear/bootstrap driver lines.

### M5. Analyst digest only contains the top 12 zones, producing a hallucinated "46 other counties" answer
- **What I did:** `curl -s -X POST http://localhost:3000/api/kamps/analyst -d '{"question":"What is the risk index for Kisumu county?"}'`.
- **What I observed:** "The data layer does not cover Kisumu county. **The digest provides risk indices for 46 other counties, but Kisumu is not among them.** ..." False twice: the app's RiskPanel shows Kisumu at 35.5 (baseline), and the digest actually contains only 12 zones, not 46.
- **Root cause (code):** `src/app/api/kamps/analyst/route.ts:62-68` builds the digest from the top 12 zones ("Zones by composite risk index (top 12 of 47)"), so 35 counties are invisible to the assistant; the LLM then invents a coverage claim.
- **Severity: MAJOR.** The analyst gives factually wrong statements about system coverage that contradict the visible UI. Any partner asking about a lower-ranked county gets told the system "does not cover" it.
- **Fix:** include all 47 zones in the digest (it is a static prompt, ~47 lines is fine; or a compact CSV-ish line per zone). Add a prompt rule: "The digest contains all N zones; never claim a county is uncovered unless it is absent from the list."

---

## MINOR

### m1. "18 ACTIVE" on the dashboard vs "24 ACTIVE" on the alerts view
- Dashboard says "RECENT ALERTS / VIEW ALL 18 ACTIVE" (link verified: clicking navigates to `#view=alerts`), landing on a page whose headline counter says "24 ACTIVE | 9 ACTION-LEVEL | 9 WATCH | 6 INFORMATIONAL". 18 = non-info alerts (`engine.ts:703`), 24 = all. Pick one definition; suggest "24 alerts (18 requiring action)". Evidence: `02-dashboard-full.png`, `09-alerts.png`.

### m2. "DRAG TO PAN" hint shows at zoom 1, but panning is impossible at zoom 1
- `county-map.tsx:128-131` clamps pan to `(0,0)` while zoom=1 (clamp(x, W*(1-z), 0) with z=1). Verified live: dragged 58x41px at zoom 1, transform stayed `translate(0 0) scale(1)`; after one zoom-in click the same drag produced `translate(-87.8 -103.9) scale(1.5)` (screenshots `05-map-panned.png`, `06-map-zoomed-panned.png`). A first-time user will try to drag the full map, see nothing happen, and conclude the map is broken. Fix: either allow pan at zoom 1 (clamp to the viewBox with negative allowed), or change the hint to "Zoom in to pan".

### m3. Gazetteer misses "Nrb, Kangemi": one real victim stays unlocated
- Recompute: MV unlocated = 34 = 33 null locations + 1 `"Nrb, Kangemi"`. "Nrb" (common Nairobi abbreviation) and "Kangemi" (a Nairobi neighborhood) are absent from `TOWN_TO_COUNTY` (`real-data.ts:56-82`), so the victim is excluded from county counts (documentedLocated 192 instead of 193). Fix: add `nrb: "Nairobi"` and `kangemi: "Nairobi"` to the gazetteer.

### m4. Real vehicle R1's "Capital FM Kenya" source link points at the homepage
- `agent-browser eval` on the vehicles view found hrefs: BBC `https://www.bbc.com/news/articles/clyzlpn84yro` (article, good) but Capital FM `https://capitalfm.africa/` (site root). The raw file `data/vehicles-public-record.json` R1 `sourceUrls[1]` is the homepage. A "documented" pattern vehicle should cite the article. Fix: replace with the specific Capital FM article URL covering the Koimburi abduction (or drop the second source link and keep BBC + the media mention in the summary).

### m5. The 429 error card ends with "The Q&A backend is optional and may not be wired in this build"
- Observed after tripping the rate limit in the UI: "ANALYST UNAVAILABLE ... responded 429: Rate limit exceeded: maximum 10 questions per minute. **The Q&A backend is optional and may not be wired in this build** ..." The backend is wired and healthy; it rate-limited. The canned suffix is misleading. Fix: branch the copy on the status code (429 -> "wait a minute and try again"; 500 -> the optional-backend sentence).

### m6. BiasPanel kicker promises "THREE LISTS" while the panel shows two
- Analytics section header: "MULTIPLE SYSTEMS ESTIMATION, THREE LISTS", immediately followed by "CAPTURE-RECAPTURE OVERLAP · THE TWO LIVE LISTS" and a two-circle Venn. The third list (occurrence book) is future data. Fix: kicker -> "MULTIPLE SYSTEMS ESTIMATION, TWO LIVE LISTS (THREE PLANNED)".

### m7. Mobile map: 4 county polygons smaller than 12px
- At 390x844, sampled path boxes: Mombasa 16x10, Kwale 7x8 (4 counties under 12px total). Mitigated by the 44px county chip buttons below the map and zoom controls, but direct polygon tapping is unreliable for small counties. Fix (polish): enlarge hit areas via a transparent duplicate path with a wider stroke for pointer events, or nudge users to the chip list.

### m8. Within the critical band, alerts are not ordered by index; dashboard vehicle KPI counts only demo-flagged vehicles
- API alert order among criticals: Kiambu (76.4) before Nairobi (84.5) (`alerts` are emitted in zone-id order, not index order). Highest-risk-first within a severity tier would read better. Also the dashboard KPI "2 · VEHICLE PATTERNS: FLAGGED AND DOCUMENTED" is exactly the two **demo** vehicles (both real vehicles are below threshold, status "monitoring"); the KPI conflates "flagged" with "documented" and is driven by synthetic records. Fix: sort zone alerts by index desc within severity; split the KPI into "flagged (demo rule demo)" vs "documented public-record patterns: 2", or annotate "(demo)".

---

## Test matrix coverage (what was checked and passed)
1. **Every view renders, no console errors:** cycled all 8 hashes at desktop and mobile; `agent-browser console`/`errors` clean after filtering React DevTools/HMR noise. No stuck skeletons except the intentional (fake) ForecastCard skeleton, see C1.
2. **Dashboard:** KPI count-ups settle at API values; as-of line; refresh does not flash (sampled 20x); 6 pipeline stages verified by DOM text.
3. **Risk map:** 47 polygons; hover tooltip (Nairobi "84.5 / 100 Critical, 52 documented, monitored pop. 4,397,073"; Wajir honest baseline "0 documented"); click opens full zone assessment matching API per-field; selected stroke verified via computed style + `aria-pressed`; zoom +/reset verified via `g[transform]` values; drag pans when zoomed; keyboard focus + Enter selects (Baringo) with focus tooltip; legend 5 entries; no-data counties: none exist (all 47 monitored; the honest "No monitoring data for this county yet" path exists in code).
4. **Analytics:** Venn 200/0/4 two circles; validation card 0.648/0.129/0.9%/97%/130; burden table 26 rows + unlocated row; RiskPanel 47 rows sorted desc with EB rates. ForecastCard FAILS (C1).
5. **Vehicles:** real vehicles have non-empty source hrefs; demo records labeled; timeline dots 6/5/2/2. Order FAILS (C4); homepage link m4.
6. **Alerts:** severity monotonic critical>elevated>watch>info; 24/24 with drivers+actions; temporal 2026-06 z 14.5 present. Copy issue M4, m8.
7. **Sources:** 8 sources; 5 connected with real row counts; blocked ones state 403/key reasons. Stale note M1.
8. **Analyst:** answers 1.6-2.3s; empty question safe (ASK disabled); rate limit 10/min enforced with graceful UI card; MSE answer includes the honest "zero overlap ... stands unadjusted" core (but leads with a wrong "estimates no underreporting" framing and the simulated-data claim, C2; coverage hallucination M5).
9. **Report:** hero, field, matrix, analysis, system, model, outlook, verdict, footer all render; coat-of-arms img `src="/kenya-coat-arms.svg"` loads (200, naturalWidth 738); "REAL INGESTED DATA" chip in `#model`; live tabs switch (Risk/Bias/Vehicles/Alerts). Stale copy M2, M3.
10. **Logo/favicon:** `/logo.svg` 200 and rendered (naturalWidth 300); `/icon.svg` 200; `src/app/icon.svg` exists.
11. **Mobile 390x844:** scrollWidth=390 on all 8 views; nav scrolls (724>390); KPI stacks 1-per-row; county chips 44px. Small polygons m7.
12. **Dark mode:** toggled on dashboard/map/report; bg/fg invert; map fills recolor; no invisible text (contrast scan). Toggle restores light.
13. **Data accuracy:** documentedTotal 226 recomputed and matched, **but** one real incident wrongly excluded (C3); populations and sums exact; highest zone 84.5; temporal 2026-06 ed=15; 0 ER matches; unlocated 34 (incl. m3).
14. **Performance:** API 8-13ms; analyst POST 2.25s; page 31ms.
15. **Em dash:** none in any view's body text, tab title, or analyst answers.
16. **A11y:** h1 on all views; `aria-current="page"` on active nav; counties focusable with Enter/Space; textarea labeled (`label for="analyst-question"`); map svg has an aria-label group description.

## Priority fix order (top 10)
1. C1 wire `analysis.forecast` into ForecastCard (+ show national forecast PIs).
2. C2 remove/replace analyst system-prompt rule 7 ("simulated demonstration dataset").
3. C3 fix `isOutsideKenya` ("outside" substring) and add the regression test; recount to 227.
4. C4 sort real vehicles before demo; align the vehicles intro copy.
5. M1 rewrite the Sources "honesty note".
6. M4 regenerate the data-mse alert text from the actual `mse` state.
7. M2 update the report footer ("live simulated run" -> real).
8. M3 make "twelve zones" / "twelve markers" counts dynamic (47).
9. M5 include all 47 zones in the analyst digest (+ no-false-coverage rule).
10. m2 fix the drag-to-pan hint or allow pan at zoom 1 (first-touch map experience).
