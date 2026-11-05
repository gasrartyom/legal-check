// Runs test cases against the real API (costs money).
// Usage: LEGAL_CHECK_MODEL=claude-haiku-5-5 node scripts/cases.ts red-light [fight ...]
import { checkSituation } from "../lib/check.ts";

// Expected section numbers; any one match counts.
const CASES = {
  "red-light": { situation: "I crossed the street on a red light in Los Angeles", expect: ["21453", "21456", "21950"] },
  fight: { situation: "Я ударил человека в драке", expect: ["242", "243"] },
  murder: { situation: "I killed a person on purpose", expect: ["187"] },
  chocolate: { situation: "Украл шоколадку в магазине", expect: ["484", "488", "490"] },
  bread: { situation: "I bought bread at a store", expect: [] as string[] },
};

// Haiku 5.5 rates for prompts <= 100K tokens; web search $10 / 1000.
const PRICE = { input: 0.1 / 1e6, output: 0.5 / 1e6, search: 0.01 };

const names = process.argv.slice(2) as (keyof typeof CASES)[];
if (!names.length || names.some((n) => !(n in CASES))) {
  console.error(`Pick cases: ${Object.keys(CASES).join(", ")}`);
  process.exit(1);
}

let failed = 0;
for (const name of names) {
  const { situation, expect } = CASES[name];
  const t = Date.now();
  const { usage, ...result } = await checkSituation("CA", situation);
  const codes = result.cards.map((c) => c.code).join(" ");
  const ok = expect.length
    ? result.verdict === "violation" && expect.some((n) => codes.includes(n))
    : result.verdict === "no_violation" && result.cards.length === 0;
  if (!ok) failed++;
  const cost =
    usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output + usage.web_searches * PRICE.search;
  console.log(`\n=== ${name}: ${ok ? "PASS" : "FAIL"} (${((Date.now() - t) / 1000).toFixed(0)}s) ===`);
  console.log(JSON.stringify(result, null, 2));
  console.log("usage", usage, `≈ $${cost.toFixed(4)} at Haiku 5.5 rates`);
}
process.exit(failed ? 1 : 0);
