import { test } from "node:test";
import assert from "node:assert/strict";
import { collectUrls, verifyCards, type Card } from "./check.ts";

const domains = ["leginfo.legislature.ca.gov", "uscode.house.gov"];
const PC187 =
  "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=187.";
const card = (url: string, confident = true): Card => ({
  code: "CA Penal Code § 187",
  url,
  plain: "",
  severity: "felony",
  penalty: "",
  confident,
});

test("collectUrls reads fetch and search results, skips errors", () => {
  const seen = new Set<string>();
  collectUrls(
    [
      { type: "web_fetch_tool_result", content: { type: "web_fetch_result", url: PC187 } },
      { type: "web_fetch_tool_result", content: { type: "web_fetch_tool_result_error", error_code: "x" } },
      { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://uscode.house.gov/a" }] },
      { type: "web_search_tool_result", content: { type: "web_search_tool_result_error" } },
      { type: "text" },
    ],
    seen,
  );
  assert.equal(seen.size, 2);
});

test("verifyCards", () => {
  const seen = new Set<string>();
  collectUrls([{ type: "web_fetch_tool_result", content: { type: "web_fetch_result", url: PC187 } }], seen);

  // fetched + allowed domain -> stays confident (www. and case differences tolerated)
  assert.equal(verifyCards([card(PC187.replace("https://", "https://www."))], seen, domains)[0].confident, true);
  // allowed domain but never fetched -> not confident
  assert.equal(verifyCards([card("https://leginfo.legislature.ca.gov/other")], seen, domains)[0].confident, false);
  // model itself unsure -> stays unsure
  assert.equal(verifyCards([card(PC187, false)], seen, domains)[0].confident, false);
  // foreign or look-alike domain -> link dropped
  for (const bad of ["https://law.justia.com/x", "https://evil-leginfo.legislature.ca.gov.com/x", "not a url"]) {
    const [c] = verifyCards([card(bad)], seen, domains);
    assert.deepEqual([c.url, c.confident], ["", false]);
  }
});
