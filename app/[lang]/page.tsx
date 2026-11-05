import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckForm } from "./check-form";
import { getDictionary, hasLocale } from "./dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const other = lang === "ru" ? "en" : "ru";
  return (
    <>
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
          <Link href={`/${other}`} hrefLang={other} lang={other} className="text-sm underline underline-offset-2 text-accent">
            {t.otherLanguage}
          </Link>
        </div>
        <p className="mt-2 text-muted">{t.intro}</p>
      </header>
      <CheckForm lang={lang} t={t} />
    </>
  );
}
