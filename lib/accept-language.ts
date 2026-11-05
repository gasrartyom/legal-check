// Same languages as app/[lang]/dictionaries.ts (kept apart so the proxy does not bundle UI strings).
export const LOCALES = ["en", "ru"];

/** First of en/ru in Accept-Language by q-value; English if neither is listed. */
export function preferred(header: string | null) {
  const langs = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q === undefined ? 1 : Number(q) };
    })
    .filter(({ lang, q }) => LOCALES.includes(lang) && q > 0)
    .sort((a, b) => b.q - a.q);
  return langs[0]?.lang ?? "en";
}
