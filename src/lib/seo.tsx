import type { Metadata } from "next";
import { locales, ogLocale, type Locale } from "./i18n";

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export function pageMeta(opts: { locale: Locale; path: string; title: string; description: string; image?: string; type?: "website" | "article"; noindex?: boolean }): Metadata {
  const { locale, path, title, description } = opts;
  const p = path.startsWith("/") ? path : `/${path}`;
  const languages = Object.fromEntries(locales.map((l) => [l === "hy" ? "hy-AM" : l, `${siteUrl()}/${l}${p === "/" ? "" : p}`]));
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}/${locale}${p === "/" ? "" : p}`, languages: { ...languages, "x-default": `${siteUrl()}/hy${p === "/" ? "" : p}` } },
    openGraph: {
      type: opts.type ?? "website", title, description, url: `${siteUrl()}/${locale}${p === "/" ? "" : p}`, locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      images: [{ url: opts.image ?? "/og.png", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [opts.image ?? "/og.png"] },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
