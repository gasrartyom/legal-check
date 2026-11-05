import { test, mock } from "node:test";
import assert from "node:assert/strict";

const noon = new Date("2026-11-05T12:00:00Z");
// A fresh module per query string: the store is chosen from env vars at import time.
const load = (query: string): Promise<typeof import("./rate-limit.ts")> => import(`./rate-limit.ts?${query}`);

test("memory store: 3 checks a day per IP, then blocked until the next UTC day", async () => {
  const { takeCheck } = await load("memory");
  for (let i = 0; i < 3; i++) assert.equal((await takeCheck("1.2.3.4", noon)).ok, true);
  const blocked = await takeCheck("1.2.3.4", noon);
  assert.deepEqual(blocked, { ok: false, resetAt: "2026-11-06T00:00:00.000Z" });
  assert.equal((await takeCheck("5.6.7.8", noon)).ok, true, "other IPs are counted separately");
  assert.equal((await takeCheck("1.2.3.4", new Date("2026-11-06T00:00:01Z"))).ok, true, "new day resets");
});

test("redis store: INCR + EXPIRE on a hashed per-day key; errors propagate", async () => {
  process.env.KV_REST_API_URL = "https://redis.example";
  process.env.KV_REST_API_TOKEN = "token";
  const { takeCheck } = await load("redis");
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json([{ result: 4 }, { result: 1 }]);
  });

  assert.deepEqual(await takeCheck("1.2.3.4", noon), { ok: false, resetAt: "2026-11-06T00:00:00.000Z" });
  assert.equal(calls[0].url, "https://redis.example/pipeline");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer token");
  const [[incr, key], expire] = JSON.parse(String(calls[0].init.body));
  assert.equal(incr, "INCR");
  assert.match(key, /^checks:2026-11-05:[0-9a-f]{32}$/);
  assert.ok(!key.includes("1.2.3.4"), "raw IP is not stored");
  assert.deepEqual(expire, ["EXPIRE", key, 172800]);

  fetchMock.mock.mockImplementation(async () => new Response("down", { status: 500 }));
  await assert.rejects(takeCheck("1.2.3.4", noon), /HTTP 500/);
});
