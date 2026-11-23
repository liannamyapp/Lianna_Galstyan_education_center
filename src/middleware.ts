import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

const LOCALES = ["hy", "ru", "en"];

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
    // Armenian is always the default: the home page and any link without a language open in Armenian,
    // whatever the browser language or a previously chosen language
    url.pathname = `/hy${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url, 301);
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
  trackSource(req, res);
  return res;
}

/**
 * CRM attribution: remembers where the visitor came from (utm_* tags, ad click ids, or an external referrer),
 * so that a lead created later is credited to the right campaign. Last campaign touch wins; plain visits keep the old one.
 */
function trackSource(req: NextRequest, res: NextResponse) {
  const q = req.nextUrl.searchParams;
  const pick = (k: string) => q.get(k)?.slice(0, 120) || undefined;
  const clid = q.has("gclid") ? "google" : q.has("fbclid") ? "facebook" : q.has("ttclid") ? "tiktok" : q.has("yclid") ? "yandex" : undefined;
  const tagged = q.has("utm_source") || q.has("ref") || clid;
  const has = req.cookies.has("lg_utm");
  let referrer: string | undefined;
  try {
    const r = req.headers.get("referer");
    if (r) { const h = new URL(r).hostname; if (h && h !== req.nextUrl.hostname) referrer = h; }
  } catch {}
  if (!tagged && (has || !referrer)) return;
  const v = {
    source: pick("utm_source") ?? pick("ref") ?? clid, medium: pick("utm_medium") ?? (clid ? "cpc" : undefined),
    campaign: pick("utm_campaign"), content: pick("utm_content"), term: pick("utm_term"),
    clid, referrer, landing: req.nextUrl.pathname.slice(0, 120),
  };
  res.cookies.set("lg_utm", encodeURIComponent(JSON.stringify(v)), { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" });
}

export const config = {
  matcher: ["/((?!api|_next|fonts|images|uploads|favicon.ico|icon|apple-icon|opengraph-image|sitemap.xml|robots.txt|manifest.webmanifest|.*\\..*).*)"],
};
