// Runs test cases against the real API (costs money).
// Usage: LEGAL_CHECK_MODEL=claude-haiku-5-5 node scripts/cases.ts red-light [fight ...]
import assert from "node:assert/strict";
import { checkSituation } from "../lib/check.ts";

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

// $ per token. shortcut: Haiku rates are for prompts <= 100K tokens (5x above), so long runs read low.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1 / 1e6, output: 0.5 / 1e6 },
  "claude-opus-5-5": { input: 4 / 1e6, output: 20 / 1e6 },
};
const SEARCH_PRICE = 0.01; // web search: $10 / 1000
const MODEL = process.env.LEGAL_CHECK_MODEL || "claude-opus-5-5"; // same default as lib/check.ts
const PRICE = PRICES[MODEL];
if (!PRICE) {
  console.error(`No prices for ${MODEL}; add them to PRICES.`);
  process.exit(1);
}

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
  const cost =
    usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output + usage.web_searches * SEARCH_PRICE;
  console.log(`\n=== ${name}: ${ok ? "PASS" : `FAIL [${failedChecks.join(", ")}]`} (${((Date.now() - t) / 1000).toFixed(0)}s) ===`);
  console.log(JSON.stringify(result, null, 2));
  console.log("usage", usage, `≈ $${cost.toFixed(4)} at ${MODEL} rates`);
}
process.exit(failed ? 1 : 0);
