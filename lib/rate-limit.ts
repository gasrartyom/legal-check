import { createHash } from "node:crypto";

export const DAILY_LIMIT = 3;

// Upstash Redis REST credentials; the Vercel Marketplace integration names them either way.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// shortcut: in-memory counts are per server instance, so on Vercel without Redis the limit is not enforced
// reliably (several instances, restarts). Fine for local dev; production needs the Redis variables.
const memory = new Map<string, number>();
if (!REDIS_URL && process.env.VERCEL) console.warn("Rate limit: Redis is not configured, using per-instance memory.");

/**
 * Counts one check for this IP today (UTC day) and says whether it is within the daily limit.
 * The IP is stored only as a hash. Redis errors propagate: the caller fails closed.
 */
export async function takeCheck(ip: string, now = new Date()): Promise<{ ok: boolean; resetAt: string }> {
  const day = now.toISOString().slice(0, 10);
  const key = `checks:${day}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const resetAt = new Date(`${day}T00:00:00Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);

  let count: number;
  if (REDIS_URL && REDIS_TOKEN) {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      // Expire after two days: the key is per day, this only cleans up.
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, 2 * 24 * 60 * 60]]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Rate limit store failed: HTTP ${res.status}`);
    const [incr] = (await res.json()) as { result?: number; error?: string }[];
    if (typeof incr?.result !== "number") throw new Error(`Rate limit store failed: ${incr?.error}`);
    count = incr.result;
  } else {
    for (const k of memory.keys()) if (!k.startsWith(`checks:${day}:`)) memory.delete(k);
    count = (memory.get(key) ?? 0) + 1;
    memory.set(key, count);
  }
  return { ok: count <= DAILY_LIMIT, resetAt: resetAt.toISOString() };
}
