import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Legal Check",
  description: "Describe what you did and see which US laws may apply, with links to official sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 sm:py-16">{children}</main>
        <footer className="w-full max-w-2xl mx-auto px-4 pb-8 text-sm text-muted">
          <div className="border-t border-line pt-4 space-y-1">
            <p>This is not legal advice. For a real situation, consult an attorney.</p>
            <p lang="ru">Это не юридическая консультация. Для реальной ситуации обратитесь к адвокату.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
