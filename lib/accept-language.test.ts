import { test } from "node:test";
import assert from "node:assert/strict";
import { preferred } from "./accept-language.ts";

test("preferred picks en/ru from Accept-Language by q-value", () => {
  assert.equal(preferred("ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"), "ru");
  assert.equal(preferred("en-US,en;q=0.9,ru;q=0.8"), "en");
  assert.equal(preferred("de-DE,de;q=0.9,ru;q=0.5,en;q=0.4"), "ru");
  assert.equal(preferred("en;q=0.5, ru;q=0.8"), "ru");
  assert.equal(preferred("fr-FR"), "en");
  assert.equal(preferred("ru;q=0"), "en");
  assert.equal(preferred(null), "en");
});
