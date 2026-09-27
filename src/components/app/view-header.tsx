import type { ReactNode } from "react";

/** Shared Swiss-minimal view header: mono kicker, red tick, h1, optional lede. */
export function ViewHeader({
  kicker,
  title,
  lede,
  aside,
}: {
  kicker: string;
  title: string;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
      <div className="min-w-0">
        <p className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="text-[var(--accent-ink)]">KAMPS</span>
          <span className="h-px w-10 bg-border" aria-hidden="true" />
          {kicker}
        </p>
        <h1 className="mt-4 text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          {title}
        </h1>
        {lede ? (
          <p className="mt-4 max-w-2xl text-base leading-[1.6] text-muted-foreground">{lede}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
