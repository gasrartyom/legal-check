"use client";

import { useState } from "react";
import { STATES, type StateCode } from "@/lib/states";

export default function Home() {
  const [state, setState] = useState<StateCode>("CA");
  const [text, setText] = useState("");

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Legal Check</h1>
        <p className="mt-2 text-muted">
          Describe what happened. We look up the actual statutes on official government sites and
          explain which laws may apply — or why none do. English or Russian.
        </p>
      </header>

      <form
        onSubmit={(e) => e.preventDefault() /* wired to /api/check in step 2 */}
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
          disabled={!text.trim()}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-background disabled:opacity-40"
        >
          Check
        </button>
      </form>
    </>
  );
}
