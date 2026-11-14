"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function UserLinks({ locale, labels }: { locale: string; labels: { admin: string; account: string; login: string; register: string } }) {
  const [ui, setUi] = useState<string | null>(null);
  useEffect(() => { setUi(document.cookie.match(/(?:^|; )lg_ui=([as])/)?.[1] ?? null); }, []);
  if (ui) return (
    <>
      {ui === "a" && <Link href="/admin" className="whitespace-nowrap text-[14.5px] text-white/90 no-underline hover:text-white">{labels.admin}</Link>}
      <Link href={`/${locale}/account`} className="btn-gold min-h-10 whitespace-nowrap px-5">{labels.account}</Link>
    </>
  );
  return (
    <>
      <Link href={`/${locale}/login`} className="whitespace-nowrap text-[14.5px] text-white no-underline hover:text-gold-300">{labels.login}</Link>
      <Link href={`/${locale}/courses`} className="btn-gold min-h-10 whitespace-nowrap px-5">{labels.register}</Link>
    </>
  );
}
