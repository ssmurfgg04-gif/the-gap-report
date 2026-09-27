"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ViewHeader } from "../view-header";

const MAX_CHARS = 500;

const SUGGESTED = [
  "Which county is hottest right now, and why?",
  "How bad is the undercount?",
  "What happened in June 2026?",
  "Where were pattern vehicles seen?",
];

type Exchange = {
  id: number;
  question: string;
  answer: string | null;
  error: string | null;
  pending: boolean;
};

async function askAnalyst(question: string): Promise<string> {
  const res = await fetch("/api/kamps/analyst", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") detail = `: ${body.error}`;
    } catch {
      // non-JSON error body, fall through to the status text
    }
    if (res.status === 404) {
      throw new Error("the analyst endpoint is not wired yet (404)");
    }
    throw new Error(`the analyst endpoint responded ${res.status}${detail}`);
  }
  const data = (await res.json()) as { answer?: unknown };
  if (typeof data.answer !== "string" || data.answer.length === 0) {
    throw new Error("the analyst endpoint returned an empty answer");
  }
  return data.answer;
}

export function AnalystView() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const nextId = useRef(0);
  const liveRef = useRef<HTMLDivElement | null>(null);

  const submit = async (text: string) => {
    const q = text.trim();
    if (!q || q.length > MAX_CHARS) return;
    const id = nextId.current++;
    setHistory((h) => [...h, { id, question: q, answer: null, error: null, pending: true }]);
    setQuestion("");
    try {
      const answer = await askAnalyst(q);
      setHistory((h) => h.map((e) => (e.id === id ? { ...e, answer, pending: false } : e)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request failed";
      setHistory((h) => h.map((e) => (e.id === id ? { ...e, error: msg, pending: false } : e)));
    } finally {
      requestAnimationFrame(() => {
        liveRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  };

  const disabled = question.trim().length === 0 || history.some((e) => e.pending);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <ViewHeader
        kicker="Ask the engine"
        title="Analyst"
        lede="Type a question, get the numbers the engine actually computed: rankings, intervals, clusters, what the data cannot support. It quotes the same aggregate stats you see across the app and refuses to go finer, because finer would mean naming people."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* suggested questions */}
        <div className="mb-6">
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Suggested
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuestion(s)}
                disabled={history.some((e) => e.pending)}
                className="min-h-[44px] rounded-full border border-border px-4 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* question form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(question);
          }}
          className="rounded-lg border border-border"
        >
          <label htmlFor="analyst-question" className="sr-only">
            Question for the KAMPS analyst
          </label>
          <Textarea
            id="analyst-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Ask about zones, estimates, clusters, vehicles, or the method itself"
            maxLength={MAX_CHARS}
            rows={3}
            className="min-h-[96px] resize-none border-0 font-mono text-[13px] leading-[1.6] shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-describedby="analyst-counter"
          />
          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
            <p
              id="analyst-counter"
              className="font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-muted-foreground"
              aria-live="polite"
            >
              {question.length} / {MAX_CHARS}
            </p>
            <Button
              type="submit"
              disabled={disabled}
              className="h-11 min-w-[128px] rounded-md bg-foreground font-mono text-[11px] uppercase tracking-[0.14em] text-background hover:bg-foreground/85 sm:h-9"
            >
              {history.some((e) => e.pending) ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Thinking
                </>
              ) : (
                <>
                  Ask
                  <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* conversation history */}
        <div ref={liveRef} aria-live="polite" className="mt-8">
          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm leading-[1.6] text-muted-foreground">
              No questions yet. The conversation stays on this device for this session; nothing is
              stored server-side.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {history.map((e) => (
                <li key={e.id} className="py-6 first:pt-0">
                  <div className="flex justify-start">
                    <div className="max-w-[85%]">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Question
                      </p>
                      <p className="mt-1.5 text-sm leading-[1.6] text-foreground">{e.question}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-muted/50 p-4">
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Analyst
                      </p>
                      {e.pending ? (
                        <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Consulting the engine
                        </p>
                      ) : e.error ? (
                        <div role="alert" className="mt-1.5">
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
                            Analyst unavailable
                          </p>
                          <p className="mt-1.5 text-sm leading-[1.6] text-muted-foreground">
                            The question could not be answered: {e.error}. The Q&amp;A backend is
                            rate-limited right now (maximum 10 questions per minute); wait a moment and try again; every answer it would
                            give is derived from the statistics shown in the other views.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-[1.6] text-foreground/90">
                          {e.answer}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.div>
    </div>
  );
}
