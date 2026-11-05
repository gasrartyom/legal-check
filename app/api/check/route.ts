import { checkSituation } from "@/lib/check";
import { STATES, type StateCode } from "@/lib/states";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const state = body?.state;
  const situation = typeof body?.situation === "string" ? body.situation.trim() : "";

  if (!Object.hasOwn(STATES, state) || !situation || situation.length > 2000) {
    return Response.json({ error: "Pick a state and describe the situation (up to 2000 characters)." }, { status: 400 });
  }

  try {
    return Response.json(await checkSituation(state as StateCode, situation));
  } catch (err) {
    console.error(err);
    // Our own errors carry a user-facing message; SDK/network errors may leak internals, so hide them.
    const msg = err instanceof Error && err.constructor === Error ? err.message : "Something went wrong. Please try again.";
    return Response.json({ error: msg }, { status: 502 });
  }
}
