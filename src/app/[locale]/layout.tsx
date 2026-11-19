import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chat } from "@/components/chat/Chat";
import { htmlLang, isLocale, locales, tr } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/seo";

export const viewport: Viewport = { themeColor: "#0f2440", width: "device-width", initialScale: 1 };

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const st = await getSettings();
  const name = tr(st.site.name, locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${name} — ${tr(st.site.tagline, locale)}`, template: `%s · ${name}` },
    description: tr(st.site.description, locale),
    applicationName: name,
    formatDetection: { telephone: false },
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    openGraph: { siteName: name, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={htmlLang[locale]}>
      <head>
        {(locale === "hy" ? ["sans-arm-400", "serif-arm-700"] : locale === "ru" ? ["sans-cyr-400", "serif-cyr-700"] : ["sans-lat-400", "serif-lat-700"]).map((f) => (
          <link key={f} rel="preload" href={`/fonts/${f}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body>
        <Header locale={locale} />
        <main id="main">{children}</main>
        <Footer locale={locale} />
        <Chat locale={locale} />
      </body>
    </html>
  );
}
