import { createHash } from "node:crypto";

export const USER_LIMIT = 3; // checks per IP per UTC day
export const SITE_LIMIT = 10; // checks per UTC day for the whole site

// Upstash Redis REST credentials; the Vercel Marketplace integration names them either way.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 2 * 24 * 60 * 60; // keys are per day; expiry only cleans up

// shortcut: in-memory counts are per server instance, so on Vercel without Redis the limits are not enforced
// reliably (several instances, restarts). Fine for local dev; production needs the Redis variables.
const memory = new Map<string, number>();
if (!REDIS_URL && process.env.VERCEL) console.warn("Rate limit: Redis is not configured, using per-instance memory.");

/** Adds delta to each counter and returns the new values. Redis errors propagate: callers fail closed. */
async function add(keys: string[], delta: 1 | -1): Promise<number[]> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return keys.map((k) => {
      const n = (memory.get(k) ?? 0) + delta;
      memory.set(k, n);
      return n;
    });
  }
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(keys.flatMap((k) => [[delta > 0 ? "INCR" : "DECR", k], ["EXPIRE", k, TTL]])),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Rate limit store failed: HTTP ${res.status}`);
  const results = (await res.json()) as { result?: number; error?: string }[];
  return keys.map((_, i) => {
    const r = results[2 * i];
    if (typeof r?.result !== "number") throw new Error(`Rate limit store failed: ${r?.error}`);
    return r.result;
  });
}

export type Take =
  | { ok: true; resetAt: string; refund: () => Promise<void> }
  | { ok: false; reason: "user" | "site"; resetAt: string };

/**
 * Counts one check for this IP and for the site today (UTC day). A rejected request uses no quota.
 * `refund` gives a failed check back to the user's quota but not the site's: the model may already have
 * run and cost money. The IP is stored only as a hash.
 */
export async function takeCheck(ip: string, now = new Date()): Promise<Take> {
  const day = now.toISOString().slice(0, 10);
  const reset = new Date(`${day}T00:00:00Z`);
  reset.setUTCDate(reset.getUTCDate() + 1);
  const resetAt = reset.toISOString();
  for (const k of memory.keys()) if (!k.startsWith(`checks:${day}:`)) memory.delete(k);

  const userKey = `checks:${day}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const keys = [userKey, `checks:${day}:site`];
  const [user, site] = await add(keys, 1);
  if (user > USER_LIMIT || site > SITE_LIMIT) {
    await add(keys, -1);
    return { ok: false, reason: user > USER_LIMIT ? "user" : "site", resetAt };
  }
  return { ok: true, resetAt, refund: async () => void (await add([userKey], -1)) };
}
