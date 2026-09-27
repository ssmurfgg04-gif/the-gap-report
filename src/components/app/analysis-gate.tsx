"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { KampsAnalysis } from "@/lib/kamps/engine";
import type { KampsState } from "./use-kamps";

/** Engine error notice, same contract as system-live.tsx. */
export function EngineErrorCard({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
        Engine error
      </p>
      <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">
        The analysis engine failed to load: {error}. Reload the page to retry.
      </p>
    </div>
  );
}

/** Loading skeleton shared by the analysis-backed views. */
export function ViewSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading engine output">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-background p-6 pb-8">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="mt-4 h-3 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-background p-6">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-3 w-full max-w-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render `children` once the engine responds; show the same skeleton and
 * error states as system-live.tsx while waiting.
 */
export function AnalysisGate({
  kamps,
  children,
}: {
  kamps: KampsState;
  children: (analysis: KampsAnalysis) => ReactNode;
}) {
  if (kamps.error) return <EngineErrorCard error={kamps.error} />;
  if (!kamps.analysis) return <ViewSkeleton />;
  return <>{children(kamps.analysis)}</>;
}
