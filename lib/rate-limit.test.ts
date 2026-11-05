import { test, mock } from "node:test";
import assert from "node:assert/strict";

const noon = new Date("2026-11-05T12:00:00Z");
const RESET = "2026-11-06T00:00:00.000Z";
// A fresh module per query string: the store is chosen from env vars at import time.
const load = (query: string): Promise<typeof import("./rate-limit.ts")> => import(`./rate-limit.ts?${query}`);

test("memory store: 3 checks per IP, rejected requests use no quota, new UTC day resets", async () => {
  const { takeCheck } = await load("user");
  for (let i = 0; i < 3; i++) assert.equal((await takeCheck("1.1.1.1", noon)).ok, true);
  assert.deepEqual(await takeCheck("1.1.1.1", noon), { ok: false, reason: "user", resetAt: RESET });
  assert.deepEqual(await takeCheck("1.1.1.1", noon), { ok: false, reason: "user", resetAt: RESET });
  // 3 used by 1.1.1.1; the two rejections did not count toward the site's 10.
  for (let i = 0; i < 7; i++) assert.equal((await takeCheck(`2.2.2.${i}`, noon)).ok, true, `site check ${4 + i}`);
  assert.deepEqual(await takeCheck("3.3.3.3", noon), { ok: false, reason: "site", resetAt: RESET });
  assert.equal((await takeCheck("1.1.1.1", new Date("2026-11-06T00:00:01Z"))).ok, true, "new day resets");
});

test("memory store: refund returns the user's quota, not the site's", async () => {
  const { takeCheck } = await load("refund");
  for (let i = 0; i < 5; i++) {
    const take = await takeCheck("1.1.1.1", noon);
    assert.ok(take.ok, `failed check ${i + 1} is refunded, so the user is never blocked`);
    await take.refund();
  }
  for (let i = 0; i < 5; i++) assert.equal((await takeCheck(`2.2.2.${i}`, noon)).ok, true);
  // 5 refunded failures + 5 successes = 10 site checks.
  assert.deepEqual(await takeCheck("1.1.1.1", noon), { ok: false, reason: "site", resetAt: RESET });
});

test("redis store: INCR/EXPIRE both counters, DECR on rejection and refund, errors propagate", async () => {
  process.env.KV_REST_API_URL = "https://redis.example";
  process.env.KV_REST_API_TOKEN = "token";
  const { takeCheck } = await load("redis");
  const bodies: (string | number)[][][] = [];
  let counts = [1, 1];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://redis.example/pipeline");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer token");
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    return Response.json(body.map((_: unknown, i: number) => ({ result: i % 2 ? 1 : counts[i / 2] })));
  });

  const take = await takeCheck("1.2.3.4", noon);
  assert.ok(take.ok);
  const [user, site] = [bodies[0][0][1] as string, bodies[0][2][1] as string];
  assert.match(user, /^checks:2026-11-05:[0-9a-f]{32}$/);
  assert.ok(!user.includes("1.2.3.4"), "raw IP is not stored");
  assert.deepEqual(bodies[0], [["INCR", user], ["EXPIRE", user, 172800], ["INCR", site], ["EXPIRE", site, 172800]]);
  await take.refund();
  assert.deepEqual(bodies[1], [["DECR", user], ["EXPIRE", user, 172800]]);

  counts = [2, 11];
  assert.deepEqual(await takeCheck("1.2.3.4", noon), { ok: false, reason: "site", resetAt: RESET });
  assert.deepEqual(bodies[3], [["DECR", user], ["EXPIRE", user, 172800], ["DECR", site], ["EXPIRE", site, 172800]]);

  fetchMock.mock.mockImplementation(async () => new Response("down", { status: 500 }));
  await assert.rejects(takeCheck("1.2.3.4", noon), /HTTP 500/);
});
