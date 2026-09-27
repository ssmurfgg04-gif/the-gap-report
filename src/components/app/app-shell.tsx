"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car, ChartLine, Database, FileText, Gauge, Map as MapIcon,
  Menu, MessageSquareText, PanelLeftClose, PanelLeftOpen, Siren, X,
} from "lucide-react";
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

type ViewId =
  | "dashboard" | "map" | "alerts"
  | "analyst" | "vehicles" | "analytics"
  | "sources" | "report";

type NavSpec = {
  id: ViewId;
  label: string;
  short: string;
  icon: typeof Gauge;
};

/** Three groups, matching the three reasons people open KAMPS. */
const NAV_GROUPS: Array<{ group: string; items: NavSpec[] }> = [
  {
    group: "Watch",
    items: [
      { id: "dashboard", label: "Dashboard", short: "Dash", icon: Gauge },
      { id: "map", label: "Risk map", short: "Map", icon: MapIcon },
      { id: "alerts", label: "Alerts", short: "Alerts", icon: Siren },
    ],
  },
  {
    group: "Investigate",
    items: [
      { id: "analyst", label: "Analyst", short: "Ask", icon: MessageSquareText },
      { id: "vehicles", label: "Vehicles", short: "Cars", icon: Car },
      { id: "analytics", label: "Analytics", short: "Stats", icon: ChartLine },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "sources", label: "Sources", short: "Data", icon: Database },
      { id: "report", label: "The report", short: "Report", icon: FileText },
    ],
  },
];

const ALL_VIEWS = NAV_GROUPS.flatMap((g) => g.items);
const VIEW_IDS = new Set<string>(ALL_VIEWS.map((v) => v.id));

function viewFromHash(): ViewId | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith("#view=")) return null;
  const id = hash.slice("#view=".length);
  return VIEW_IDS.has(id) ? (id as ViewId) : null;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function LiveDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
      <span
        className={`absolute inline-flex h-full w-full rounded-full ${
          online ? "animate-ping bg-[var(--accent-ink)] opacity-60" : ""
        }`}
      />
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${
          online ? "bg-[var(--accent-ink)]" : "bg-border"
        }`}
      />
    </span>
  );
}

export function AppShell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [mapSeed, setMapSeed] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const kamps = useKamps(60_000); // auto-refresh every 60s while the tab is visible

  // collapse preference survives reloads
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kamps:nav-collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      // private mode: default expanded
    }
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem("kamps:nav-collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

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
    setDrawerOpen(false);
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

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

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

  const navList = (opts: { compactLabels?: boolean; onNavigate?: () => void }) => (
    <nav aria-label="Views" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((g) => (
        <div key={g.group} className="mb-5 last:mb-0">
          <p
            className={`px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 ${
              collapsed ? "text-center px-0" : ""
            }`}
          >
            {collapsed ? "·" : g.group}
          </p>
          <ul className="space-y-0.5">
            {g.items.map(({ id, label, short, icon: Icon }) => {
              const active = view === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      changeView(id);
                      opts.onNavigate?.();
                    }}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] ${
                      collapsed ? "justify-center px-0" : ""
                    } ${
                      active
                        ? "bg-foreground/[0.04] font-medium text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                    }`}
                  >
                    {active ? (
                      <span
                        className={`absolute bg-[var(--accent-ink)] transition-all duration-200 ${
                          collapsed ? "inset-y-2 left-0 w-[3px] rounded-r" : "inset-y-1.5 left-0 w-[3px] rounded-r"
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                        active
                          ? "text-[var(--accent-ink)]"
                          : "text-muted-foreground/80 group-hover:text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    {!collapsed ? <span className="truncate">{label}</span> : <span className="sr-only">{short}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brandBlock = (
    <button
      type="button"
      onClick={() => changeView("dashboard")}
      className="group flex w-full items-center gap-3 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-ink)]"
      aria-label="KAMPS home"
    >
      <img
        src="/logo.svg"
        alt=""
        className="h-7 w-auto shrink-0 transition-opacity duration-300 group-hover:opacity-80"
      />
      {!collapsed ? (
        <span className="min-w-0 flex flex-col items-start leading-none">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Live monitor
          </span>
          <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
            <LiveDot online={online} />
            <span className={online ? "text-[var(--accent-ink)]" : "text-muted-foreground"}>
              {online ? "engine online" : "engine unreachable"}
            </span>
          </span>
        </span>
      ) : (
        <span className="sr-only">KAMPS</span>
      )}
    </button>
  );

  const sidebarFooter = (
    <div className={`border-t border-border px-3 py-3 ${collapsed ? "px-2" : ""}`}>
      {!collapsed && asOf ? (
        <p className="px-3 pb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          data as of {asOf}
        </p>
      ) : null}
      <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] lg:flex"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <span
          className={`inline-flex items-center gap-2 rounded-full border border-[var(--accent-ink)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)] ${
            collapsed ? "px-1.5" : ""
          }`}
          title="Every number traces to a source on the Sources tab"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-ink)]" aria-hidden="true" />
          {!collapsed && "real data"}
        </span>
        <span className={collapsed ? "" : "shrink-0"}>
          <ThemeToggle />
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#kamps-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:outline-2 focus:outline-[var(--accent-ink)]"
      >
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[68px]" : "w-[232px]"
        }`}
      >
        <div className="border-b border-border">{brandBlock}</div>
        {navList({})}
        {sidebarFooter}
      </aside>

      {/* mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => changeView("dashboard")}
            className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-ink)]"
            aria-label="KAMPS home"
          >
            <img src="/logo.svg" alt="KAMPS" className="h-6 w-auto" />
          </button>
          <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <LiveDot online={online} />
            <span className={online ? "text-[var(--accent-ink)]" : ""}>
              {online ? "live" : "offline"}
            </span>
            {asOf ? <span className="hidden truncate sm:inline">· {asOf}</span> : null}
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px] lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {drawerOpen ? (
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.26, ease: EASE }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-background shadow-xl lg:hidden"
            role="dialog"
            aria-label="Views"
          >
            <div className="flex items-center justify-between border-b border-border pr-2">
              {brandBlock}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {navList({ onNavigate: () => setDrawerOpen(false) })}
            {sidebarFooter}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <main id="kamps-main" className="min-w-0 flex-1">
        <div className="h-14 lg:hidden" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            {content(view, kamps)}
          </motion.div>
        </AnimatePresence>

        {view !== "report" ? (
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              KAMPS · Kenya Abduction Monitoring & Prediction System
            </p>
            <button
              type="button"
              onClick={() => changeView("sources")}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
            >
              Method &amp; sources
            </button>
            <button
              type="button"
              onClick={() => changeView("report")}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
            >
              Full report
            </button>
            <p className="ml-auto max-w-sm font-mono text-[10px] leading-[1.7] tracking-[0.06em] text-muted-foreground/80">
              Aggregate zone-level output only. No individuals, no plates, no case-level data.
            </p>
          </div>
        </footer>
        ) : null}
      </main>
    </div>
  );
}
