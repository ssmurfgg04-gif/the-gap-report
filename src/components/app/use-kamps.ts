"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KampsAnalysis } from "@/lib/kamps/engine";

export type KampsState = {
  analysis: KampsAnalysis | null;
  error: string | null;
  /** epoch ms of the last successful fetch; null until the first one */
  updatedAt: number | null;
  /** true while a fetch is in flight */
  loading: boolean;
  refresh: () => void;
};

/**
 * Fetch /api/kamps on mount, then poll every `pollMs` while the tab is
 * visible. Follows the same fetch / error contract as system-live.tsx.
 */
export function useKamps(pollMs = 0): KampsState {
  const [analysis, setAnalysis] = useState<KampsAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      fetch("/api/kamps", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`engine responded ${r.status}`);
          return r.json() as Promise<KampsAnalysis>;
        })
        .then((data) => {
          if (cancelled) return;
          setAnalysis(data);
          setError(null);
          setUpdatedAt(Date.now());
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "engine failure");
        })
        .finally(() => {
          if (cancelled) return;
          inFlight.current = false;
          setLoading(false);
        });
    };

    run();

    if (pollMs > 0) {
      const id = window.setInterval(() => {
        if (document.visibilityState === "visible") run();
      }, pollMs);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [pollMs, tick]);

  return { analysis, error, updatedAt, loading, refresh };
}
