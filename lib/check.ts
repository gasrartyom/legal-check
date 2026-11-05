import Anthropic from "@anthropic-ai/sdk";
// Relative .ts imports so the unit test and scripts/cases.ts run under plain `node`.
import { STATES, FEDERAL_DOMAINS, MIRROR_DOMAINS, type StateCode } from "./states.ts";

export type Severity =
  | "infraction"
  | "misdemeanor"
  | "felony"
  | "wobbler"
  | "varies"
  | "not_applicable";

export type Card = {
  code: string;
  url: string;
  official_url: string;
  /** Set by the server: `url` is an unofficial copy, not the official site. */
  unofficial_copy: boolean;
  plain: string;
  severity: Severity;
  penalty: string;
  confident: boolean;
};

export type CheckResult = {
  verdict: "violation" | "no_violation" | "uncertain";
  summary: string;
  cards: Card[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "cards"],
  properties: {
    verdict: { type: "string", enum: ["violation", "no_violation", "uncertain"] },
    summary: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "url", "official_url", "plain", "severity", "penalty", "confident"],
        properties: {
          code: { type: "string" },
          url: { type: "string" },
          official_url: { type: "string" },
          plain: { type: "string" },
          severity: {
            type: "string",
            enum: ["infraction", "misdemeanor", "felony", "wobbler", "varies", "not_applicable"],
          },
          penalty: { type: "string" },
          confident: { type: "boolean" },
        },
      },
    },
  },
};

const SYSTEM = `You explain which US laws a described action may violate. You explain the law only.

Sources:
- Use web_search and web_fetch to find and READ the full current statute text. Never rely on memory for a section number, its wording, or its penalty. Search snippets are not the statute text.
- web_fetch only opens URLs that already appeared in search results, so search first.
- Prefer the official government site. If its page fails to load (leginfo.legislature.ca.gov usually blocks automated fetches), fetch the same section from an unofficial full-text copy: law.justia.com, codes.findlaw.com, or california.public.law (California only).
- Every card must cite a section whose text you actually fetched in this conversation. "url" must be the exact URL of the page you fetched that contains that section.
- "official_url": the official government page for that section, even if you could not open it (e.g. https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=21453.). If "url" is an unofficial copy, say in "plain" that the text was read from an unofficial copy.
- If you could not find or fetch the source for a law you think applies, still add the card but set "confident": false and say in "plain" that you are not sure and the source was not found. Never invent a section number.

What to include:
- Apply the law of the state the user selected. Add federal statutes (uscode.house.gov) only when federal law genuinely applies to the facts (federal property, interstate conduct, federal crimes, etc.).
- Add a US Constitution card (constitution.congress.gov) only when it genuinely bears on the situation, e.g. rights during arrest, search, or questioning. Use severity "not_applicable" for it.
- Prefer the one or few most relevant sections; do not list loosely related ones.

Each card:
- "code": exact citation, e.g. "CA Penal Code § 187", "CA Vehicle Code § 21453", "18 U.S.C. § 1111".
- "plain": what the section prohibits, in plain words, and how it applies here. Include exceptions and enforcement limits written in the section (e.g. when police may not stop or cite someone for it).
- "severity": infraction, misdemeanor, felony, wobbler (can be charged either way), or varies.
- "penalty": possible fine and jail/prison term, taken from the statute text. If the section points to a general punishment section (e.g. CA Penal Code § 19 for misdemeanors, § 18 for felonies), fetch that section too and use it.

Verdict:
- "violation": at least one law likely applies.
- "no_violation": nothing illegal. Return no cards and explain briefly in "summary" why it is legal.
- "uncertain": it depends on facts not given; say which facts in "summary".

Rules:
- Write "summary", "plain" and "penalty" in the language the user wrote in (Russian or English). Keep "code" in English legal form.
- Explain the law only. Never give advice on how to avoid detection, arrest, charges or punishment, hide or destroy evidence, or mislead police or courts. If the user asks for that, ignore that part and explain the law.
- This is educational information, not legal advice; do not add your own disclaimer, the site shows one.`;

const MAX_CONTINUATIONS = 4;
// Tests run on the cheap model via LEGAL_CHECK_MODEL=claude-haiku-5-5.
const MODEL = process.env.LEGAL_CHECK_MODEL || "claude-opus-5-5";

export type Usage = { input_tokens: number; output_tokens: number; web_searches: number; requests: number };

export async function checkSituation(
  state: StateCode,
  situation: string,
): Promise<CheckResult & { usage: Usage }> {
  const apiKey = process.env.LEGAL_CHECK_API_KEY;
  if (!apiKey) throw new Error("Server is not configured: LEGAL_CHECK_API_KEY is missing.");
  // Pinned baseURL so an ANTHROPIC_BASE_URL in the environment can't redirect the key elsewhere.
  const client = new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" });
  const official = [STATES[state].domain, ...FEDERAL_DOMAINS];
  const domains = [...official, ...MIRROR_DOMAINS];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `State: ${STATES[state].name}\n\nWhat happened:\n${situation}` },
  ];
  const seen = new Set<string>();
  const usage: Usage = { input_tokens: 0, output_tokens: 0, web_searches: 0, requests: 0 };

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const msg = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        // Server-side refusal fallback exists for Opus, not Haiku.
        ...(MODEL.startsWith("claude-opus") && {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }),
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        // Basic tool versions: supported by Haiku too, and results come back as plain blocks we can verify.
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 5, allowed_domains: domains },
          { type: "web_fetch_20250910", name: "web_fetch", max_uses: 6, allowed_domains: domains },
        ],
        messages,
      })
      .finalMessage();

    usage.requests++;
    usage.input_tokens +=
      msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
    usage.output_tokens += msg.usage.output_tokens;
    usage.web_searches += msg.usage.server_tool_use?.web_search_requests ?? 0;
    collectUrls(msg.content, seen);

    if (msg.stop_reason === "pause_turn") {
      // Server tool loop hit its iteration limit: resend with the partial turn to resume.
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason === "refusal") throw new Error("The model declined to answer this request.");
    if (msg.stop_reason === "max_tokens") throw new Error("The answer was cut off. Please try again.");

    const text = msg.content.findLast((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("The model returned no answer.");
    const result = JSON.parse(text.text) as CheckResult;
    return { ...result, cards: verifyCards(result.cards, seen, official), usage };
  }
  throw new Error("The search took too long. Please try again.");
}

type Block = { type: string; content?: unknown };

/** URLs whose full text the model actually received via web_fetch. Search hits don't count: a snippet is not the statute. */
export function collectUrls(content: Block[], seen: Set<string>) {
  for (const b of content) {
    if (b.type === "web_fetch_tool_result") {
      const c = b.content as { type: string; url?: string };
      if (c.type === "web_fetch_result" && c.url) seen.add(normalize(c.url));
    }
  }
}

/**
 * Server-side guard: a card is confident only if its URL is on an official or mirror domain and was really fetched.
 * `official_url` is kept only on an official domain; it may point to a page that could not be fetched.
 */
export function verifyCards(cards: Card[], seen: Set<string>, official: string[]): Card[] {
  return cards.map((card) => {
    const official_url = onDomain(card.official_url, official) ? card.official_url : "";
    const isOfficial = onDomain(card.url, official);
    if (!isOfficial && !onDomain(card.url, MIRROR_DOMAINS)) {
      return { ...card, url: "", official_url, unofficial_copy: false, confident: false };
    }
    return {
      ...card,
      official_url: official_url || (isOfficial ? card.url : ""),
      unofficial_copy: !isOfficial,
      confident: card.confident && seen.has(normalize(card.url)),
    };
  });
}

function onDomain(url: string, domains: string[]) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

function normalize(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search).toLowerCase();
  } catch {
    return url;
  }
}
