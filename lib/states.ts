// Official statute sites. Adding a state = one line.
export const STATES = {
  CA: { name: "California", domain: "leginfo.legislature.ca.gov" },
  NY: { name: "New York", domain: "nysenate.gov" },
  TX: { name: "Texas", domain: "statutes.capitol.texas.gov" },
  FL: { name: "Florida", domain: "leg.state.fl.us" },
  IL: { name: "Illinois", domain: "ilga.gov" },
} as const;

export type StateCode = keyof typeof STATES;

export const FEDERAL_DOMAINS = ["uscode.house.gov", "constitution.congress.gov"];

// Unofficial full-text copies, used when an official site blocks fetching (leginfo sits behind Cloudflare).
// california.public.law covers CA only; harmless for other states.
export const MIRROR_DOMAINS = ["law.justia.com", "codes.findlaw.com", "california.public.law"];
