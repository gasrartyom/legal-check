"use client";

import { useState } from "react";
import { STATES, type StateCode } from "@/lib/states";
import type { Card, CheckResult, Severity } from "@/lib/check";

const VERDICT: Record<CheckResult["verdict"], { label: string; tone: string }> = {
  violation: {
    label: "Likely breaks the law",
    tone: "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  },
  no_violation: {
    label: "No law broken",
    tone: "border-green-200 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100",
  },
  uncertain: {
    label: "Depends on facts not given",
    tone: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  },
};

// Empty label: no badge (used for Constitution cards).
const SEVERITY: Record<Severity, string> = {
  infraction: "Infraction",
  misdemeanor: "Misdemeanor",
  felony: "Felony",
  wobbler: "Misdemeanor or felony",
  varies: "Varies",
  not_applicable: "",
};

// Model text follows the user's language; mark Russian so screen readers switch voice.
const langOf = (text: string) => (/[а-яё]/i.test(text) ? "ru" : undefined);

function LawCard({ card }: { card: Card }) {
  // url and official_url are checked on the server: empty or on an allowed domain.
  const link = "underline underline-offset-2 text-accent";
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold">{card.code}</h3>
        {SEVERITY[card.severity] && (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {SEVERITY[card.severity]}
          </span>
        )}
      </div>
      {!card.confident && (
        <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
          Not verified: we could not read this section&apos;s text, so details may be wrong.
        </p>
      )}
      <p lang={langOf(card.plain)} className="mt-2 leading-relaxed">
        {card.plain}
      </p>
      {card.penalty && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-medium">Penalty: </span>
          <span lang={langOf(card.penalty)}>{card.penalty}</span>
        </p>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {card.url ? (
          <a href={card.url} target="_blank" rel="noopener noreferrer" className={link}>
            {card.unofficial_copy ? `Text read on ${new URL(card.url).hostname} (unofficial copy)` : "Official text"}
          </a>
        ) : (
          <span className="text-muted">Source not found</span>
        )}
        {card.unofficial_copy && card.official_url && (
          <a href={card.official_url} target="_blank" rel="noopener noreferrer" className={link}>
            Official text
          </a>
        )}
      </p>
    </article>
  );
}

export default function Home() {
  const [state, setState] = useState<StateCode>("CA");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, situation: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Legal Check</h1>
        <p className="mt-2 text-muted">
          Describe what happened. We look up the actual statutes on official government sites (or
          a full-text copy when the official site is unreachable) and explain which laws may apply —
          or why none do. English or Russian.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      >
        <label className="block">
          <span className="text-sm font-medium">State</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as StateCode)}
            className="mt-1 block w-full rounded-lg border border-line bg-background px-3 py-2.5"
          >
            {Object.entries(STATES).map(([code, s]) => (
              <option key={code} value={code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">What happened?</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="e.g. I crossed the street on a red light"
            className="mt-1 block w-full rounded-lg border border-line bg-background px-3 py-2.5 resize-y"
          />
        </label>

        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-background disabled:opacity-40"
        >
          {loading ? "Searching official sources…" : "Check"}
        </button>
      </form>

      <div aria-live="polite" className="mt-6">
        {error && <p className="text-red-600">{error}</p>}
        {result && (
          <section aria-label="Result" className="space-y-4">
            <div className={`rounded-2xl border p-4 sm:p-5 ${VERDICT[result.verdict].tone}`}>
              <h2 className="text-lg font-semibold">{VERDICT[result.verdict].label}</h2>
              <p lang={langOf(result.summary)} className="mt-1 leading-relaxed">
                {result.summary}
              </p>
            </div>
            {result.cards.map((card, i) => (
              <LawCard key={`${card.code}-${i}`} card={card} />
            ))}
          </section>
        )}
      </div>
    </>
  );
}
