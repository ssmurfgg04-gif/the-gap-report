"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const sections = [
  { id: "field", label: "The Field" },
  { id: "matrix", label: "The Matrix" },
  { id: "analysis", label: "Analysis" },
  { id: "system", label: "The System" },
  { id: "outlook", label: "Outlook" },
  { id: "verdict", label: "Verdict" },
];

export function Header() {
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    };
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) {
        const observer = new IntersectionObserver(callback, {
          rootMargin: "-40% 0px -55% 0px",
        });
        observer.observe(el);
        observers.push(observer);
      }
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-border bg-background/90 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a
          href="#top"
          className="group flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-ink)]"
        >
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--accent-ink)] transition-transform duration-300 group-hover:rotate-45" />
          <span className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-foreground">
            The Gap Report
          </span>
        </a>

        <nav aria-label="Section navigation" className="hidden items-center gap-1 md:flex">
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)] ${
                active === id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
            Kenya · 2027
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
