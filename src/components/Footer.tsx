import { ameriaEnabled, idramEnabled } from "@/lib/payments";
import Link from "next/link";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { Icon } from "./Icon";

export async function Footer({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const st = await getSettings();
  const c = st.contacts;
  const social = [
    c.telegram && { href: `https://t.me/${c.telegram.replace(/^@/, "")}`, icon: "telegram", label: "Telegram" },
    c.whatsapp && { href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`, icon: "whatsapp", label: "WhatsApp" },
    c.instagram && { href: c.instagram, icon: "instagram", label: "Instagram" },
    c.facebook && { href: c.facebook, icon: "facebook", label: "Facebook" },
  ].filter(Boolean) as { href: string; icon: string; label: string }[];
  return (
    <footer className="mt-24 bg-navy-950 text-[#b9c4d4]">
      <div className="container-x grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emblem.svg" alt="" width={110} height={60} className="mb-3 h-[60px] w-auto" />
          <p className="font-serif text-[22px] font-bold tracking-[0.06em] text-white">{tr(st.site.name, locale)}</p>
          <p className="mt-2 text-[14px]">{tr(st.site.tagline, locale)} · {tr(c.city, locale)}</p>
          {social.length > 0 && (
            <div className="mt-5 flex gap-2.5">
              {social.map((x) => (
                <a key={x.icon} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.label}
                  className="flex size-11 items-center justify-center rounded-full border border-[#2c3d57] text-[#dfe6f0] transition-colors hover:border-gold-500 hover:text-gold-300"><Icon name={x.icon} size={18} /></a>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2.5 text-[14px]">
          <p className="font-semibold text-white">{t.footer.contacts}</p>
          {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-[#b9c4d4] no-underline hover:text-white">{c.phone}</a>}
          {c.email && <a href={`mailto:${c.email}`} className="break-all text-[#b9c4d4] no-underline hover:text-white">{c.email}</a>}
          <Link href={`/${locale}/contact`} className="text-[#b9c4d4] no-underline hover:text-white">{t.contact.title}</Link>
        </div>
        <div className="flex flex-col gap-2.5 text-[14px]">
          <p className="font-semibold text-white">{t.footer.documents}</p>
          <Link href={`/${locale}/p/contract`} className="text-[#b9c4d4] no-underline hover:text-white">{t.footer.contract}</Link>
          <Link href={`/${locale}/p/refund`} className="text-[#b9c4d4] no-underline hover:text-white">{t.footer.refund}</Link>
          <Link href={`/${locale}/p/privacy`} className="text-[#b9c4d4] no-underline hover:text-white">{t.footer.privacy}</Link>
        </div>
        {(st.payments.card || idramEnabled() || ameriaEnabled()) && <div className="flex flex-col gap-3 text-[14px]">
          <p className="font-semibold text-white">{t.footer.payment}</p>
          <div className="flex flex-wrap gap-2" aria-label="Visa, Mastercard, ArCa">
            <span className="rounded-md bg-white px-2.5 py-1 font-sans text-[14px] font-extrabold italic tracking-wide text-[#1a1f71]">VISA</span>
            <span className="rounded-md bg-white px-2.5 py-1 text-[13px] font-bold text-[#222]">Mastercard</span>
            <span className="rounded-md bg-white px-2.5 py-1 text-[13px] font-bold text-[#0a5c36]">ArCa</span>
            {idramEnabled() && <span className="rounded-md bg-white px-2.5 py-1 text-[13px] font-bold text-[#e4542b]">Idram</span>}
          </div>
          <Link href={`/${locale}/p/refund`} className="text-[12.5px] text-[#b9c4d4] hover:text-white">{t.footer.refund}</Link>
        </div>}
      </div>
      <div className="container-x flex flex-wrap justify-between gap-3 border-t border-[#1f3049] pt-6 pb-24 text-[12.5px]">
        <span>© {new Date().getFullYear()} {tr(st.legal.entity, locale)} · {t.footer.tin} {st.legal.tin} · {tr(st.legal.address, locale)}</span>
        {tr(st.legal.endorsement, locale) && <span>{tr(st.legal.endorsement, locale)}</span>}
      </div>
    </footer>
  );
}
