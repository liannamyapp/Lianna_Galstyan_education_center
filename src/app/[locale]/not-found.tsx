"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict } from "@/lib/i18n";

export default function NotFound() {
  const locale = usePathname()?.match(/^\/(hy|ru|en)(\/|$)/)?.[1] || "hy";
  const t = getDict(locale);
  return (
    <div className="container-x max-w-[620px] py-24 text-center">
      <p className="font-serif text-[72px] leading-none font-bold text-gold-500">404</p>
      <h1 className="mt-4 font-serif text-[30px] font-bold text-navy-900">{t.common.notFound}</h1>
      <p className="mt-2 text-muted">{t.common.notFoundText}</p>
      <Link href={`/${locale}`} className="btn-navy mt-7">{t.common.toHome}</Link>
    </div>
  );
}
