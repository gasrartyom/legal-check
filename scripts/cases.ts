// Runs test cases against the real API (costs money).
// Usage: LEGAL_CHECK_MODEL=claude-haiku-5-5 node scripts/cases.ts red-light [fight ...]
import assert from "node:assert/strict";
import { checkSituation, type Usage } from "../lib/check.ts";

// `expect`: section numbers, any one match counts. `cite`: every one must be a card's section
// (exact number: 21456 doesn't match 21456.1). `mention`: must appear somewhere in the answer.
const CASES: Record<string, { situation: string; expect: string[]; cite?: string[]; mention?: RegExp }> = {
  "red-light": {
    situation: "I crossed the street on a red light in Los Angeles",
    expect: ["21453", "21456", "21950"],
    // General red-signal rule (§ 21453(d)) and the pedestrian-signal rule (§ 21456).
    cite: ["21453", "21456"],
    // AB 2147 (Freedom to Walk Act): no stop unless there is an immediate danger of collision.
    mention: /(immediate|imminent) danger/i,
  },
  fight: { situation: "Я ударил человека в драке", expect: ["242", "243"] },
  murder: { situation: "I killed a person on purpose", expect: ["187"] },
  chocolate: { situation: "Украл шоколадку в магазине", expect: ["484", "488", "490"] },
  bread: { situation: "I bought bread at a store", expect: [] },
};

// $ per MTok by a step's prompt size: [input, output, cache read]; 5-minute cache writes cost 1.25x input.
// Haiku 5.5 has two rate cards, split at a 100K-token prompt.
type Rates = (prompt: number) => [number, number, number];
const RATES: Record<string, Rates> = {
  "claude-haiku-5-5": (p) => (p > 100_000 ? [0.5, 2.5, 0.05] : [0.1, 0.5, 0.01]),
  "claude-sonnet-5-5": () => [2, 10, 0.2],
  "claude-opus-5-5": () => [4, 20, 0.2],
};
const SEARCH_PRICE = 0.01; // web search: $10 / 1000
const MODEL = process.env.LEGAL_CHECK_MODEL || "claude-opus-5-5"; // same default as lib/check.ts
if (!RATES[MODEL]) {
  console.error(`No prices for ${MODEL}; add them to RATES.`);
  process.exit(1);
}

/** Dollars for a run, pricing each sampling step at the rate card its prompt size falls into. */
function price(rates: Rates, usage: Pick<Usage, "steps" | "web_searches">) {
  let total = usage.web_searches * SEARCH_PRICE;
  for (const s of usage.steps) {
    const read = s.cache_read_input_tokens ?? 0;
    const write = s.cache_creation_input_tokens ?? 0;
    const [input, output, cached] = rates(s.max_prompt ?? s.input_tokens + read + write);
    total += (s.input_tokens * input + write * 1.25 * input + read * cached + s.output_tokens * output) / 1e6;
  }
  return total;
}
const step = (input_tokens: number, read = 0, write = 0, output_tokens = 0, max_prompt?: number) =>
  ({ input_tokens, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens, max_prompt });
// 50K prompt at the low card; 150K prompt (mostly cache reads) at the high card: 0.5*10K + 1.25*0.5*40K + 0.05*100K.
assert.equal(price(RATES["claude-haiku-5-5"], { steps: [step(50_000, 0, 0, 1000)], web_searches: 1 }).toFixed(6), "0.015500");
assert.equal(price(RATES["claude-haiku-5-5"], { steps: [step(10_000, 100_000, 40_000)], web_searches: 0 }).toFixed(6), "0.035000");
// Same tokens merged from steps whose largest prompt is 60K: low card, 0.1*10K + 1.25*0.1*40K + 0.01*100K.
assert.equal(price(RATES["claude-haiku-5-5"], { steps: [step(10_000, 100_000, 40_000, 0, 60_000)], web_searches: 0 }).toFixed(6), "0.007000");

/** Card codes cite exactly this section: "21456" matches "§ 21456(b)", not "§ 21456.1" or "§ 121456". */
const citesSection = (codes: string, n: string) =>
  new RegExp(`(?<![\\d.])${n.replaceAll(".", "\\.")}(?!\\.?\\d)`).test(codes);
assert.ok(citesSection("§ 21453(d) § 21456.1", "21453") && !citesSection("§ 21456.1 § 121456", "21456"));

const names = process.argv.slice(2);
if (!names.length || names.some((n) => !(n in CASES))) {
  console.error(`Pick cases: ${Object.keys(CASES).join(", ")}`);
  process.exit(1);
}

let failed = 0;
for (const name of names) {
  const { situation, expect, cite = [], mention } = CASES[name];
  const t = Date.now();
  const { usage, ...result } = await checkSituation("CA", situation);
  const codes = result.cards.map((c) => c.code).join(" ");
  const checks = {
    verdict: expect.length
      ? result.verdict === "violation" && expect.some((n) => codes.includes(n))
      : result.verdict === "no_violation" && result.cards.length === 0,
    cite: cite.every((n) => citesSection(codes, n)),
    mention: !mention || mention.test(JSON.stringify(result)),
    // Prompt makes the "newer amendments" search mandatory for every card.
    amendment_search: !result.cards.length || usage.amendment_searches > 0,
  };
  const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const ok = !failedChecks.length;
  if (!ok) failed++;
  const sum = (k: "cache_read_input_tokens" | "cache_creation_input_tokens") =>
    usage.steps.reduce((n, s) => n + (s[k] ?? 0), 0);
  const largest = Math.max(
    ...usage.steps.map((s) => s.max_prompt ?? s.input_tokens + (s.cache_read_input_tokens ?? 0) + (s.cache_creation_input_tokens ?? 0)),
  );
  console.log(`\n=== ${name}: ${ok ? "PASS" : `FAIL [${failedChecks.join(", ")}]`} (${((Date.now() - t) / 1000).toFixed(0)}s) ===`);
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `tokens: prompt ${usage.input_tokens} (cache read ${sum("cache_read_input_tokens")}, cache write ${sum("cache_creation_input_tokens")}),`,
    `output ${usage.output_tokens}; ${usage.steps.length} steps, largest prompt ${usage.steps.some((s) => s.max_prompt) ? "<= " : ""}${largest};`,
    `searches ${usage.web_searches} (amendments ${usage.amendment_searches}) ≈ $${price(RATES[MODEL], usage).toFixed(4)} at ${MODEL} rates`,
  );
}
process.exit(failed ? 1 : 0);
