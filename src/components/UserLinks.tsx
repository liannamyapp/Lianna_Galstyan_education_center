"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function UserLinks({ locale, labels }: { locale: string; labels: { admin: string; account: string; login: string; register: string } }) {
  const [ui, setUi] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  // re-read after every navigation, so the header switches right after sign-up, sign-in or sign-out
  useEffect(() => {
    const role = document.cookie.match(/(?:^|; )lg_ui=([as])/)?.[1] ?? null;
    setUi(role);
    if (!role) { setUnread(0); return; }
    let live = true;
    fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((d: { unread?: number }) => { if (live) setUnread(d.unread ?? 0); }).catch(() => {});
    return () => { live = false; };
  }, [pathname]);
  if (ui) return (
    <>
      {ui === "a" && <Link href="/admin" className="whitespace-nowrap text-[14.5px] text-white/90 no-underline hover:text-white">{labels.admin}</Link>}
      <Link href={`/${locale}/account${unread ? "#notifications" : ""}`} className="btn-gold relative min-h-10 whitespace-nowrap px-5">
        {labels.account}
        {unread > 0 && <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-[#c2412d] px-1.5 text-[11.5px] leading-5 font-bold text-white" aria-label={`${unread}`}>{unread}</span>}
      </Link>
    </>
  );
  return (
    <>
      <Link href={`/${locale}/login`} className="whitespace-nowrap text-[14.5px] text-white no-underline hover:text-gold-300">{labels.login}</Link>
      <Link href={`/${locale}/courses`} className="btn-gold min-h-10 whitespace-nowrap px-5">{labels.register}</Link>
    </>
  );
}
