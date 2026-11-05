import { checkSituation, CheckError } from "@/lib/check";
import { takeCheck } from "@/lib/rate-limit";
import { STATES, type StateCode } from "@/lib/states";

// A check is one model call with web search/fetch loops: ~20-40s, more with continuations.
export const maxDuration = 120;

// Responses carry error codes; the UI translates them (app/[lang]/dictionaries.ts).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const state = body?.state;
  const situation = typeof body?.situation === "string" ? body.situation.trim() : "";

  if (!Object.hasOwn(STATES, state) || !situation || situation.length > 2000) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    // Vercel overwrites x-forwarded-for with the client IP, so it can't be spoofed there.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const limit = await takeCheck(ip);
    if (!limit.ok) {
      const retryAfter = Math.ceil((Date.parse(limit.resetAt) - Date.now()) / 1000);
      return Response.json(
        { error: "rate_limited", resetAt: limit.resetAt },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const { usage, ...result } = await checkSituation(state as StateCode, situation);
    console.log("usage", usage);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    // Only our own codes reach the user; SDK, network and rate-limit store errors may leak internals.
    return Response.json({ error: err instanceof CheckError ? err.message : "failed" }, { status: 502 });
  }
}
