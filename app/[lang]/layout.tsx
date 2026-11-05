import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, LOCALES } from "./dictionaries";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: t.title,
    description: t.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <html lang={lang} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 sm:py-16">{children}</main>
        <footer className="w-full max-w-2xl mx-auto px-4 pb-8 text-sm text-muted">
          <p className="border-t border-line pt-4">{t.disclaimer}</p>
        </footer>
      </body>
    </html>
  );
}
