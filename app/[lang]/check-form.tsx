"use client";

import { useState } from "react";
import { STATES, type StateCode } from "@/lib/states";
import type { Card, CheckResult } from "@/lib/check";
import type { Dict, Locale } from "./dictionaries";

const TONE: Record<CheckResult["verdict"], string> = {
  violation: "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  no_violation: "border-green-200 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100",
  uncertain: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
};

// Model text follows the user's language, not the UI's; mark it so screen readers pick the right voice.
const langOf = (text: string) => (/[а-яё]/i.test(text) ? "ru" : "en");

function LawCard({ card, t }: { card: Card; t: Dict }) {
  // url and official_url are checked on the server: empty or on an allowed domain.
  const link = "underline underline-offset-2 text-accent";
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold">{card.code}</h3>
        {t.severity[card.severity] && (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {t.severity[card.severity]}
          </span>
        )}
      </div>
      {!card.confident && (
        <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">{t.notVerified}</p>
      )}
      <p lang={langOf(card.plain)} className="mt-2 leading-relaxed">
        {card.plain}
      </p>
      {card.penalty && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-medium">{t.penalty} </span>
          <span lang={langOf(card.penalty)}>{card.penalty}</span>
        </p>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {card.url ? (
          <a href={card.url} target="_blank" rel="noopener noreferrer" className={link}>
            {card.unofficial_copy ? t.unofficialCopy.replace("{host}", new URL(card.url).hostname) : t.officialText}
          </a>
        ) : (
          <span className="text-muted">{t.sourceNotFound}</span>
        )}
        {card.unofficial_copy && card.official_url && (
          <a href={card.official_url} target="_blank" rel="noopener noreferrer" className={link}>
            {t.officialText}
          </a>
        )}
      </p>
    </article>
  );
}

export function CheckForm({ lang, t }: { lang: Locale; t: Dict }) {
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) return setResult(data);
      const code = data.error as keyof Dict["errors"];
      const message = Object.hasOwn(t.errors, code) ? t.errors[code] : t.errors.failed;
      const time = data.resetAt
        ? new Date(data.resetAt).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })
        : "";
      setError(message.replace("{time}", time));
    } catch {
      setError(t.errors.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <label className="block">
          <span className="text-sm font-medium">{t.state}</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as StateCode)}
            className="mt-1 block w-full rounded-lg border border-line bg-background px-3 py-2.5"
          >
            {Object.entries(STATES).map(([code, s]) => (
              <option key={code} value={code}>
                {lang === "ru" ? s.ru : s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">{t.situation}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={t.placeholder}
            className="mt-1 block w-full rounded-lg border border-line bg-background px-3 py-2.5 resize-y"
          />
        </label>

        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-background disabled:opacity-40"
        >
          {loading ? t.checking : t.check}
        </button>
        <p className="text-center text-sm text-muted">{t.limitNote}</p>
      </form>

      <div aria-live="polite" className="mt-6">
        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        )}
        {result && (
          <section className="space-y-4">
            <div className={`rounded-2xl border p-4 sm:p-5 ${TONE[result.verdict]}`}>
              <h2 className="text-lg font-semibold">{t.verdict[result.verdict]}</h2>
              <p lang={langOf(result.summary)} className="mt-1 leading-relaxed">
                {result.summary}
              </p>
            </div>
            {result.cards.map((card, i) => (
              <LawCard key={`${card.code}-${i}`} card={card} t={t} />
            ))}
          </section>
        )}
      </div>
    </>
  );
}
