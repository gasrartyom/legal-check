// Official statute sites. Adding a state = one line.
export const STATES = {
  CA: { name: "California", ru: "Калифорния", domain: "leginfo.legislature.ca.gov" },
  NY: { name: "New York", ru: "Нью-Йорк", domain: "nysenate.gov" },
  TX: { name: "Texas", ru: "Техас", domain: "statutes.capitol.texas.gov" },
  FL: { name: "Florida", ru: "Флорида", domain: "leg.state.fl.us" },
  IL: { name: "Illinois", ru: "Иллинойс", domain: "ilga.gov" },
} as const;

export type StateCode = keyof typeof STATES;

export const FEDERAL_DOMAINS = ["uscode.house.gov", "constitution.congress.gov"];

// Unofficial full-text copies, used when an official site blocks fetching (leginfo sits behind Cloudflare).
// california.public.law covers CA only; harmless for other states.
export const MIRROR_DOMAINS = ["law.justia.com", "codes.findlaw.com", "california.public.law"];
