"use client";

import { useState } from "react";
import { STATES, type StateCode } from "@/lib/states";
import type { CheckResult } from "@/lib/check";

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
        {/* shortcut: raw JSON until the card UI lands in step 3 */}
        {result && <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result, null, 2)}</pre>}
      </div>
    </>
  );
}
