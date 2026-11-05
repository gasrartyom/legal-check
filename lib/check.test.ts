import { test } from "node:test";
import assert from "node:assert/strict";
import { collectUrls, verifyCards, type Card } from "./check.ts";

const domains = ["leginfo.legislature.ca.gov", "uscode.house.gov"];
const PC187 =
  "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=187.";
const MIRROR = "https://california.public.law/codes/ca_penal_code_section_187";
const card = (url: string, confident = true, official_url = PC187): Card => ({
  code: "CA Penal Code § 187",
  url,
  official_url,
  unofficial_copy: false,
  plain: "",
  severity: "felony",
  penalty: "",
  confident,
});

test("collectUrls keeps only fetched pages: search hits and errors don't count", () => {
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
  assert.deepEqual([...seen], ["leginfo.legislature.ca.gov/faces/codes_displaysection.xhtml?lawcode=pen&sectionnum=187."]);
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
  for (const bad of ["https://example.com/x", "https://evil-leginfo.legislature.ca.gov.com/x", "not a url"]) {
    const [c] = verifyCards([card(bad)], seen, domains);
    assert.deepEqual([c.url, c.confident], ["", false]);
  }

  // fetched mirror -> confident, flagged unofficial, official link kept
  collectUrls([{ type: "web_fetch_tool_result", content: { type: "web_fetch_result", url: MIRROR } }], seen);
  const [m] = verifyCards([card(MIRROR)], seen, domains);
  assert.deepEqual([m.confident, m.unofficial_copy, m.official_url], [true, true, PC187]);
  // official_url must be on an official domain; an official url doubles as official_url
  assert.equal(verifyCards([card(MIRROR, true, "https://law.justia.com/x")], seen, domains)[0].official_url, "");
  assert.equal(verifyCards([card(PC187, true, "")], seen, domains)[0].official_url, PC187);
});
