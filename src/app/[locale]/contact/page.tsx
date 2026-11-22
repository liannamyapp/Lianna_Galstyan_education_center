import type { Metadata } from "next";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { pageMeta } from "@/lib/seo";
import { contactAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return pageMeta({ locale, path: "/contact", title: t.contact.title, description: t.contact.text });
}

export default async function Contact({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDict(locale);
  const st = await getSettings();
  const c = st.contacts;
  const items = [
    c.phone && { icon: "phone", label: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}` },
    c.email && { icon: "mail", label: c.email, href: `mailto:${c.email}` },
    c.whatsapp && { icon: "whatsapp", label: "WhatsApp", href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}` },
    c.telegram && { icon: "telegram", label: `@${c.telegram.replace(/^@/, "")}`, href: `https://t.me/${c.telegram.replace(/^@/, "")}` },
  ].filter(Boolean) as { icon: string; label: string; href: string }[];
  return (
    <div className="container-x flex flex-wrap gap-10 pt-16">
      <div className="min-w-0 flex-[1_1_340px]">
        <p className="eyebrow">{t.nav.contact}</p>
        <h1 className="h-section mt-2.5">{t.contact.title}</h1>
        <p className="mt-3 text-muted">{t.contact.text}</p>
        <ul className="mt-8 flex list-none flex-col gap-3 p-0">
          {items.map((x) => (
            <li key={x.icon}><a href={x.href} className="card flex items-center gap-4 p-4 no-underline transition-shadow hover:shadow-lg" {...(x.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              <span className="flex size-11 items-center justify-center rounded-full bg-sand text-navy-800"><Icon name={x.icon} /></span><span className="font-semibold break-all text-navy-900">{x.label}</span>
            </a></li>
          ))}
        </ul>
        <p className="mt-5 text-[14px] text-muted">{tr(c.city, locale)}</p>
        <div className="card mt-5 p-5 text-[14px] leading-relaxed">
          <p className="m-0 mb-1.5 font-semibold text-navy-900">{t.footer.legal}</p>
          <p className="m-0">{tr(st.legal.entity, locale)}</p>
          <p className="m-0">{t.footer.tin}: {st.legal.tin}</p>
          <p className="m-0">{t.footer.address}: {tr(st.legal.address, locale)}</p>
        </div>
      </div>
      <ActionForm action={contactAction} successReplace className="card flex min-w-0 flex-[1_1_480px] flex-col gap-4 p-7 sm:p-9">
        <input type="hidden" name="locale" value={locale} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <label className="label">{t.auth.name}<input name="name" required minLength={2} autoComplete="name" className="input" /></label>
        <div className="flex flex-wrap gap-4">
          <label className="label flex-[1_1_220px]">{t.auth.email}<input name="email" type="email" required autoComplete="email" className="input" /></label>
          <label className="label flex-[1_1_220px]">{t.auth.phone}<input name="phone" type="tel" autoComplete="tel" className="input" /></label>
        </div>
        <label className="label">{t.contact.message}<textarea name="message" required minLength={5} maxLength={4000} rows={6} className="input py-3" /></label>
        <SubmitButton className="btn-navy self-start" pendingText={t.common.sending}>{t.contact.send}</SubmitButton>
      </ActionForm>
    </div>
  );
}
