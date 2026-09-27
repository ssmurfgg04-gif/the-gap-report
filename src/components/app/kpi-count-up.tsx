"use client";

import { useEffect, useRef, useState } from "react";

const defaultFormat = (n: number): string =>
  new Intl.NumberFormat("en-US").format(Math.round(n));

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animate from 0 to `value` over `duration` ms with an ease-out curve.
 * Respects prefers-reduced-motion by settling instantly on the final value.
 */
export function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (duration <= 0 || prefersReducedMotion()) {
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(value * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return display;
}

/** Tabular-nums count-up number. Re-renders as the value animates. */
export function CountUp({
  value,
  duration = 900,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const n = useCountUp(value, duration);
  const fmt = format ?? defaultFormat;
  return <span className={className}>{fmt(n)}</span>;
}
