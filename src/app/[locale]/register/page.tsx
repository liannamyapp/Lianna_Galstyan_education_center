import type { Metadata } from "next";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { pageMeta } from "@/lib/seo";
import { registerAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ locale, path: "/register", title: getDict(locale).auth.registerTitle, description: "", noindex: true });
}

export default async function Register({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  const { next = "" } = await searchParams;
  const t = getDict(locale);
  return (
    <AuthShell title={t.auth.registerTitle} footer={<>{t.auth.haveAccount} <Link href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold">{t.auth.loginBtn}</Link></>}>
      <ActionForm action={registerAction} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="next" value={next} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <label className="label">{t.auth.name}<input name="name" required minLength={2} autoComplete="name" className="input" /></label>
        <label className="label">{t.auth.email}<input name="email" type="email" required autoComplete="email" className="input" /></label>
        <label className="label">{t.auth.phone}<input name="phone" type="tel" autoComplete="tel" placeholder="+374" className="input" /></label>
        <label className="label">{t.auth.password}<input name="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="pw-hint" className="input" /><span id="pw-hint" className="font-normal text-muted">{t.auth.passwordHint}</span></label>
        <p className="m-0 text-[13px] text-muted">{t.auth.consent} <Link href={`/${locale}/p/privacy`}>{t.footer.privacy}</Link></p>
        <SubmitButton className="btn-navy w-full" pendingText={t.common.sending}>{t.auth.registerBtn}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
