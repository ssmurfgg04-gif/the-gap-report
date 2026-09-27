import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="grain-overlay" aria-hidden="true" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
        <p className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="text-[var(--accent-ink)]">KAMPS</span>
          <span className="h-px w-10 bg-border" aria-hidden="true" />
          404
        </p>
        <h1 className="display-balance mt-6 max-w-2xl text-4xl font-medium tracking-[-0.025em] text-foreground sm:text-5xl">
          Nothing documented at this address.
        </h1>
        <p className="lede mt-5 max-w-xl text-base leading-[1.6] text-muted-foreground">
          The page you asked for is not in the record. The monitor itself is one click away,
          and every view lives off the left navigation.
        </p>
        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-md bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-ink)]"
          >
            Back to the dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
