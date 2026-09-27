"use client";

import { cn } from "@/lib/utils";
import type { RiskBand } from "@/lib/kamps/stats";

export const BAND_LABELS: Record<RiskBand, string> = {
  critical: "Critical",
  elevated: "Elevated",
  watch: "Watch",
  baseline: "Baseline",
};

export function BandChip({ band, className }: { band: RiskBand; className?: string }) {
  const styles: Record<RiskBand, string> = {
    critical: "bg-[var(--accent-ink)] text-white",
    elevated: "border border-[var(--accent-ink)] text-[var(--accent-ink)]",
    watch: "border border-dashed border-[var(--accent-ink)]/70 text-[var(--accent-ink)]/90",
    baseline: "border border-border text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        styles[band],
        className
      )}
    >
      {BAND_LABELS[band]}
    </span>
  );
}

export function ConfChip({ level }: { level: "high" | "medium" | "low" }) {
  const label = level === "high" ? "High conf" : level === "medium" ? "Med conf" : "Low conf";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          level === "high" && "bg-[var(--accent-ink)]",
          level === "medium" && "bg-[var(--accent-ink)]/60",
          level === "low" && "bg-border"
        )}
      />
      {label}
    </span>
  );
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function pValue(p: number): string {
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(3)}`;
}
