import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

const LOCALES = ["hy", "ru", "en"];

function preferred(req: NextRequest) {
  const c = req.cookies.get("lg_locale")?.value;
  if (c && LOCALES.includes(c)) return c;
  const al = req.headers.get("accept-language")?.toLowerCase() ?? "";
  if (al.startsWith("ru")) return "ru";
  if (al.startsWith("en")) return "en";
  return "hy";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!s || s.role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/hy/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const seg = pathname.split("/")[1];
  if (!LOCALES.includes(seg)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${preferred(req)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  if (/^\/(hy|ru|en)\/account/.test(pathname)) {
    const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!s) {
      const url = req.nextUrl.clone();
      url.pathname = `/${seg}/login`;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }
  const res = NextResponse.next();
  if (req.cookies.get("lg_locale")?.value !== seg) res.cookies.set("lg_locale", seg, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}

export const config = {
  matcher: ["/((?!api|_next|fonts|images|uploads|favicon.ico|icon|apple-icon|opengraph-image|sitemap.xml|robots.txt|manifest.webmanifest|.*\\..*).*)"],
};
