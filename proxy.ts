import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, preferred } from "./lib/accept-language";

const COOKIE = "lang";

/** "/" goes to the last chosen language, else the browser's preferred one; /en and /ru remember the choice. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const current = pathname.slice(1);
  if (LOCALES.includes(current)) {
    const res = NextResponse.next();
    if (request.cookies.get(COOKIE)?.value !== current) {
      res.cookies.set(COOKIE, current, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/" });
    }
    return res;
  }
  const saved = request.cookies.get(COOKIE)?.value;
  const lang = saved && LOCALES.includes(saved) ? saved : preferred(request.headers.get("accept-language"));
  return NextResponse.redirect(new URL(`/${lang}`, request.url));
}

export const config = { matcher: ["/", "/en", "/ru"] };
