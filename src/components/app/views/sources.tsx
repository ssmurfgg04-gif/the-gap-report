"use client";

import { motion } from "framer-motion";
import { ViewHeader } from "../view-header";

type SourceStatus = "connected" | "sandbox-blocked" | "manual";

type SourceSpec = {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  status: SourceStatus;
  statusNote: string;
  license: string;
  retrieved: string;
  feeds: string;
};

/**
 * Static provenance register. Honest by construction: no row counts, no fake
 * timestamps. When a live /api/kamps/sources endpoint ships, this list is the
 * shape it should hydrate.
 */
const SOURCES: SourceSpec[] = [
  {
    id: "missing-voices",
    name: "Missing Voices Coalition",
    tier: 1,
    status: "connected",
    statusNote: "missingvoices.or.ke, scraped with rate limiting: 200 victim records and 7 years of monthly statistics",
    license: "civil society documentation (Police Reforms Working Group Kenya); cited back to the site",
    retrieved: "retrieved 2026-09-27, verified pages only",
    feeds: "the victim list and the monthly enforced-disappearance series powering temporal analysis and forecast",
  },
  {
    id: "knchr",
    name: "KNCHR statements",
    tier: 1,
    status: "connected",
    statusNote: "June 2026 protest violations statement, 31 Aug and 3 Sept 2026 statements ingested with names and dates",
    license: "Kenya National Commission on Human Rights, public press statements",
    retrieved: "retrieved 2026-09-27 from knchr.org",
    feeds: "named June 2026 victims, the 35-case Reparations Framework count, the September Kiprotich abduction",
  },
  {
    id: "public-record",
    name: "Public-record incident curation",
    tier: 1,
    status: "connected",
    statusNote: "31 incidents 2024 to 2026, every entry with a fetched source URL (BBC, Capital FM, The Star, KNCHR)",
    license: "per-item publisher of record, linked",
    retrieved: "compiled 2026-09-27 from curl-verified sources and Wikipedia reference extraction",
    feeds: "the second capture-recapture list, vehicle pattern cases, and the monitored incident window",
  },
  {
    id: "knbs-census",
    name: "Kenya 2019 Census (KNBS)",
    tier: 1,
    status: "connected",
    statusNote: "47 county populations summing exactly to the official 47,564,296 total",
    license: "open government data (Kenya National Bureau of Statistics), via Wikipedia compilation",
    retrieved: "retrieved 2026-09-27, cross-checked against the census total",
    feeds: "per-capita rates, Empirical Bayes denominators, population-adjusted scan statistics",
  },
  {
    id: "ucdp-ged",
    name: "UCDP GED v26.1",
    tier: 2,
    status: "connected",
    statusNote: "1,246 georeferenced organized-violence events for Kenya 1989 to 2025, county-assigned by point-in-polygon",
    license: "CC BY 4.0 (Uppsala Conflict Data Program)",
    retrieved: "retrieved 2026-09-27 from ucdp.uu.se bulk download (upgraded from v23.1: 118 events added for 2023-2025)",
    feeds: "historical violence baseline covariate, forecast training panels, walk-forward backtest",
  },
  {
    id: "counties-geo",
    name: "County boundaries (IEBC)",
    tier: 2,
    status: "connected",
    statusNote: "47 county polygons, simplified to 173 KB for the interactive map; used server-side for event geocoding",
    license: "Kenya IEBC boundaries via open data compilation",
    retrieved: "retrieved 2026-09-27",
    feeds: "the interactive county map and UCDP event county assignment",
  },
  {
    id: "reliefweb",
    name: "ReliefWeb",
    tier: 2,
    status: "sandbox-blocked",
    statusNote: "v2 API requires a pre-approved appname (403 without one). Appname requested 2026-09-27 via the official form; ReliefWeb replies within two business days. scripts/ingest-reliefweb.mjs runs once RELIEFWEB_APPNAME is set",
    license: "API open; per-item publisher licenses apply",
    retrieved: "not retrieved yet; request pending, failure documented in the ingest manifest",
    feeds: "situational context layer once the appname clears",
  },
  {
    id: "acled",
    name: "ACLED",
    tier: 2,
    status: "sandbox-blocked",
    statusNote: "needs an account key. Registration is Cloudflare-walled from this host and the API subdomain does not resolve publicly; scripts/ingest-acled.mjs is wired and runs when ACLED_EMAIL and ACLED_KEY are set. UCDP GED covers the same role through 2025",
    license: "registered access (Armed Conflict Location & Event Data Project)",
    retrieved: "never retrieved from this environment",
    feeds: "second conflict-event baseline for cross-database comparison",
  },
  {
    id: "tella",
    name: "Tella field feed",
    tier: 1,
    status: "manual",
    statusNote: "encrypted field collection deploys in roadmap Phase 3 with trained monitors",
    license: "partner consent-based collection",
    retrieved: "not yet deployed; documented public-record sightings feed the rule meanwhile",
    feeds: "the live sighting stream for the four-zone vehicle rule",
  },
];

const TIER_STYLES: Record<1 | 2 | 3, string> = {
  1: "bg-foreground text-background",
  2: "border border-foreground text-foreground",
  3: "border border-border text-muted-foreground",
};

const STATUS_STYLES: Record<SourceStatus, string> = {
  connected: "border border-[var(--accent-ink)] text-[var(--accent-ink)]",
  "sandbox-blocked": "border border-dashed border-muted-foreground/60 text-muted-foreground",
  manual: "border border-border text-muted-foreground",
};

const STATUS_LABEL: Record<SourceStatus, string> = {
  connected: "Connected",
  "sandbox-blocked": "Waiting",
  manual: "Manual",
};

export function SourcesView() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="Provenance"
        title="Data sources"
        lede="What the engine reads, where each feed stands, and what is blocking the rest. Tier 1 anchors the count, tier 2 corroborates, tier 3 is human curation. No invented rows anywhere: when a source is missing, the gap is the story."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rounded-lg border border-border border-l-2 border-l-[var(--accent-ink)] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
            Honesty note
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-[1.6] text-muted-foreground">
            Everything the engine consumes sits in this register with its access state. Where a
            source is blocked, the blocker is named: ACLED needs a manual browser registration,
            ReliefWeb is reviewing our appname request, police and mortuary records need Access
            to Information filings. Nothing is padded to look busier than it is.
          </p>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
          {SOURCES.map((s, i) => (
            <motion.article
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
              className="bg-background p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${TIER_STYLES[s.tier]}`}
                >
                  Tier {s.tier}
                </span>
                <h2 className="text-base font-medium text-foreground">{s.name}</h2>
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${STATUS_STYLES[s.status]}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      s.status === "connected" ? "bg-[var(--accent-ink)]" : "bg-border"
                    }`}
                  />
                  {STATUS_LABEL[s.status]}
                </span>
              </div>

              <dl className="mt-4 space-y-2.5 text-sm leading-[1.6]">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Status
                  </dt>
                  <dd className="text-muted-foreground">{s.statusNote}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    License
                  </dt>
                  <dd className="text-muted-foreground">{s.license}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Feeds
                  </dt>
                  <dd className="text-muted-foreground">{s.feeds}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Retrieved
                  </dt>
                  <dd className="text-muted-foreground">{s.retrieved}</dd>
                </div>
              </dl>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
