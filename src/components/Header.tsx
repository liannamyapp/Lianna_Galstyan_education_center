import Link from "next/link";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { UserLinks } from "./UserLinks";
import { MobileMenu } from "./MobileMenu";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";
import { Icon } from "./Icon";

export async function Header({ locale }: { locale: Locale }) {
  const [t, st] = [getDict(locale), await getSettings()];
  const links = [
    { href: `/${locale}/courses`, label: t.nav.courses },
    { href: `/${locale}#directions`, label: t.nav.directions },
    { href: `/${locale}/verify`, label: t.nav.verify },
    { href: `/${locale}#reviews`, label: t.nav.reviews, wide: true },
    { href: `/${locale}/blog`, label: t.nav.blog },
    { href: `/${locale}/contact`, label: t.nav.contact },
  ];
  const userLinks = <UserLinks locale={locale} labels={{ admin: t.nav.admin, account: t.nav.account, login: t.nav.login, register: t.nav.register }} />;
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-navy-900 text-white shadow-[0_6px_24px_rgba(8,20,38,.25)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-navy-950">{t.nav.skip}</a>
      <div className="container-x flex items-center justify-between gap-5 py-4">
        <Logo href={`/${locale}`} name={tr(st.site.name, locale)} tagline={tr(st.site.tagline, locale)} />
        <nav aria-label={t.nav.menu} className="hidden items-center gap-5 text-[14.5px] xl:flex 2xl:gap-7">
          {links.map((l) => <Link key={l.href} href={l.href} className={`whitespace-nowrap text-[#dfe6f0] no-underline transition-colors hover:text-gold-300 ${"wide" in l ? "hidden 2xl:inline" : ""}`}>{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-4 xl:flex">
          <LangSwitch locale={locale} label={t.nav.language} />
          {userLinks}
        </div>
        <MobileMenu className="group relative xl:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full ring-1 ring-white/30 [&::-webkit-details-marker]:hidden" aria-label={t.nav.menu}>
            <Icon name="menu" className="group-open:hidden" /><Icon name="close" className="hidden group-open:block" />
          </summary>
          <div className="absolute right-0 z-40 mt-3 max-h-[calc(100dvh-96px)] w-[min(86vw,340px)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-navy-950 p-5 shadow-2xl">
            <nav aria-label={t.nav.menu} className="flex flex-col gap-1">
              {links.map((l) => <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-[15px] text-[#dfe6f0] no-underline hover:bg-white/5">{l.label}</Link>)}
            </nav>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">{userLinks}</div>
            <div className="mt-4"><LangSwitch locale={locale} label={t.nav.language} /></div>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
