"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/lib/i18n";

export function LangSwitch({ locale, label, dark = true }: { locale: Locale; label: string; dark?: boolean }) {
  const path = usePathname() || `/${locale}`;
  const rest = path.replace(/^\/(hy|ru|en)(?=\/|$)/, "");
  return (
    <nav aria-label={label} className={`flex rounded-full p-[3px] text-[12.5px] font-semibold ${dark ? "border border-white/25" : "border border-line bg-white"}`}>
      {locales.map((l) => (
        <Link key={l} href={`/${l}${rest}`} hrefLang={l} prefetch={false} aria-current={l === locale ? "true" : undefined}
          className={`rounded-full px-2.5 py-1.5 no-underline transition-colors ${l === locale ? "bg-gold-500 text-navy-950" : dark ? "text-[#dfe6f0] hover:text-white" : "text-muted hover:text-navy-900"}`}>
          {localeNames[l as Locale]}
        </Link>
      ))}
    </nav>
  );
}
