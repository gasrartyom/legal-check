// UI strings. The model's answer follows the language the user writes in, not these.
const en = {
  title: "Legal Check",
  description: "Describe what you did and see which US laws may apply, with links to the statute text.",
  intro:
    "Describe what happened. We look up the actual statutes on official government sites (or a full-text copy when the official site is unreachable) and explain which laws may apply — or why none do. English or Russian.",
  otherLanguage: "Русский",
  state: "State",
  situation: "What happened?",
  placeholder: "e.g. I crossed the street on a red light",
  check: "Check",
  checking: "Searching the statutes…",
  limitNote: "Up to 3 checks per day.",
  verdict: {
    violation: "Likely breaks the law",
    no_violation: "No law broken",
    uncertain: "Depends on facts not given",
  },
  // Empty: no badge (used for Constitution cards).
  severity: {
    infraction: "Infraction",
    misdemeanor: "Misdemeanor",
    felony: "Felony",
    wobbler: "Misdemeanor or felony",
    varies: "Varies",
    not_applicable: "",
  },
  notVerified: "Not verified: we could not read this section's text, so details may be wrong.",
  penalty: "Penalty:",
  unofficialCopy: "Text read on {host} (unofficial copy)",
  officialText: "Official text",
  sourceNotFound: "Source not found",
  errors: {
    invalid_input: "Pick a state and describe the situation (up to 2000 characters).",
    rate_limited: "Daily limit reached: up to 3 checks per day. You can check again after {time}.",
    not_configured: "The service is not set up yet. Please try again later.",
    refused: "The model declined to answer this request.",
    cut_off: "The answer was cut off. Please try again.",
    no_answer: "The model returned no answer. Please try again.",
    timeout: "The search took too long. Please try again.",
    failed: "Something went wrong. Please try again.",
  },
  disclaimer: "This is not legal advice. For a real situation, consult an attorney.",
};

export type Dict = typeof en;

const ru: Dict = {
  title: "Legal Check",
  description: "Опишите, что вы сделали, и узнайте, какие законы США могут применяться, со ссылками на текст закона.",
  intro:
    "Опишите, что произошло. Мы находим действующие законы на официальных сайтах (или полный текст закона в неофициальной копии, если официальный сайт недоступен) и объясняем, какие из них могут применяться — или почему никакие. Можно писать по-русски или по-английски.",
  otherLanguage: "English",
  state: "Штат",
  situation: "Что произошло?",
  placeholder: "Например: перешёл улицу на красный свет",
  check: "Проверить",
  checking: "Ищем законы…",
  limitNote: "Не больше 3 проверок в день.",
  verdict: {
    violation: "Скорее всего, это нарушение",
    no_violation: "Нарушения нет",
    uncertain: "Зависит от обстоятельств",
  },
  severity: {
    // US terms in brackets: the model's text often uses them as is.
    infraction: "Мелкое нарушение (infraction)",
    misdemeanor: "Проступок (misdemeanor)",
    felony: "Тяжкое преступление (felony)",
    wobbler: "Проступок или тяжкое (wobbler)",
    varies: "Зависит от случая",
    not_applicable: "",
  },
  notVerified: "Не проверено: текст статьи прочитать не удалось, детали могут быть неточными.",
  penalty: "Наказание:",
  unofficialCopy: "Текст прочитан на {host} (неофициальная копия)",
  officialText: "Официальный текст",
  sourceNotFound: "Источник не найден",
  errors: {
    invalid_input: "Выберите штат и опишите ситуацию (до 2000 символов).",
    rate_limited: "Лимит исчерпан: не больше 3 проверок в день. Следующая проверка будет доступна после {time}.",
    not_configured: "Сервис ещё не настроен. Попробуйте позже.",
    refused: "Модель отказалась отвечать на этот запрос.",
    cut_off: "Ответ оборвался. Попробуйте ещё раз.",
    no_answer: "Модель не вернула ответ. Попробуйте ещё раз.",
    timeout: "Поиск занял слишком много времени. Попробуйте ещё раз.",
    failed: "Что-то пошло не так. Попробуйте ещё раз.",
  },
  disclaimer: "Это не юридическая консультация. Для реальной ситуации обратитесь к адвокату.",
};

const dictionaries = { en, ru };

export type Locale = keyof typeof dictionaries;
export const LOCALES = Object.keys(dictionaries) as Locale[];

export const hasLocale = (locale: string): locale is Locale => Object.hasOwn(dictionaries, locale);

export const getDictionary = (locale: Locale) => dictionaries[locale];
