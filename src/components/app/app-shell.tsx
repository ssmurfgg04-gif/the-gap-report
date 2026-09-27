"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { useKamps, type KampsState } from "./use-kamps";
import { DashboardView } from "./views/dashboard";
import { MapView } from "./views/map-view";
import { AnalyticsView } from "./views/analytics";
import { VehiclesView } from "./views/vehicles";
import { AlertsView } from "./views/alerts";
import { SourcesView } from "./views/sources";
import { AnalystView } from "./views/analyst";
import { ReportView } from "./views/report";

const VIEWS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "map", label: "Risk Map" },
  { id: "analytics", label: "Analytics" },
  { id: "vehicles", label: "Vehicles" },
  { id: "alerts", label: "Alerts" },
  { id: "sources", label: "Sources" },
  { id: "analyst", label: "Analyst" },
  { id: "report", label: "Report" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const VIEW_IDS = new Set<string>(VIEWS.map((v) => v.id));

function viewFromHash(): ViewId | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith("#view=")) return null;
  const id = hash.slice("#view=".length);
  return VIEW_IDS.has(id) ? (id as ViewId) : null;
}

export function AppShell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [mapSeed, setMapSeed] = useState<string | null>(null);
  const kamps = useKamps(60_000); // auto-refresh every 60s while the tab is visible

  // initial view from the URL hash, plus back/forward and manual hash edits
  useEffect(() => {
    const apply = () => {
      const v = viewFromHash();
      if (v) setView(v);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const changeView = useCallback((next: ViewId) => {
    setView(next);
    const url = new URL(window.location.href);
    url.hash = `view=${next}`;
    history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const openMapAt = useCallback(
    (countyKey: string | null) => {
      setMapSeed(countyKey);
      changeView("map");
    },
    [changeView]
  );

  const content = (v: ViewId, k: KampsState) => {
    switch (v) {
      case "dashboard":
        return <DashboardView kamps={k} onOpenMap={openMapAt} onNavigate={changeView} />;
      case "map":
        return <MapView kamps={k} seedCounty={mapSeed} />;
      case "analytics":
        return <AnalyticsView kamps={k} />;
      case "vehicles":
        return <VehiclesView kamps={k} />;
      case "alerts":
        return <AlertsView kamps={k} />;
      case "sources":
        return <SourcesView />;
      case "analyst":
        return <AnalystView />;
      case "report":
        return <ReportView />;
    }
  };

  const online = !kamps.error;
  const asOf = kamps.analysis ? kamps.analysis.asOf.slice(0, 10) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        {/* main row */}
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => changeView("dashboard")}
              className="group flex shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-ink)]"
              aria-label="KAMPS home"
            >
                            <img
                src="/logo.svg"
                alt="KAMPS: Kenya Abduction Monitoring & Prediction System"
                className="h-6 w-auto transition-opacity duration-300 group-hover:opacity-80 sm:h-7"
              />
            </button>
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
            <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${online ? "animate-ping bg-[var(--accent-ink)] opacity-60" : ""}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 animate-pulse rounded-full ${online ? "bg-[var(--accent-ink)]" : "bg-border"}`}
                />
              </span>
              <span className="hidden font-medium text-[var(--accent-ink)] sm:inline">LIVE</span>
              <span className="hidden truncate sm:inline">{online ? "engine online" : "engine unreachable"}</span>
              {asOf ? <span className="hidden truncate lg:inline">· data as of {asOf}</span> : null}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                kamps.analysis?.simulated
                  ? "border-dashed border-[var(--accent-ink)] text-[var(--accent-ink)]"
                  : "border-[var(--accent-ink)] text-[var(--accent-ink)]"
              }`}
              title={
                kamps.analysis?.simulated
                  ? "Demonstration dataset"
                  : "Real ingested datasets: Missing Voices, public-record curation, KNBS 2019 census, UCDP GED"
              }
            >
              {kamps.analysis ? (kamps.analysis.simulated ? "Demo dataset" : "Real data") : kamps.error ? "no data" : "connecting"}
            </span>
            <ThemeToggle />
          </div>
        </div>

        {/* view navigation: scrollable row on mobile, right-aligned on desktop */}
        <nav
          aria-label="View navigation"
          className="mx-auto max-w-6xl overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 md:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex items-center gap-1 md:justify-end">
            {VIEWS.map(({ id, label }) => {
              const active = view === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => changeView(id)}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-[44px] items-center whitespace-nowrap px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] md:min-h-[36px] ${
                      active
                        ? "text-foreground after:absolute after:inset-x-2 after:bottom-[7px] after:h-[2px] after:bg-[var(--accent-ink)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {content(view, kamps)}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
