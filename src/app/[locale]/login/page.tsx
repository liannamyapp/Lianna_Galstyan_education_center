import type { Metadata } from "next";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { pageMeta } from "@/lib/seo";
import { loginAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ locale, path: "/login", title: getDict(locale).auth.loginTitle, description: "", noindex: true });
}

export default async function Login({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  const { next = "" } = await searchParams;
  const t = getDict(locale);
  return (
    <AuthShell title={t.auth.loginTitle} footer={<>{t.auth.noAccount} <Link href={`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold">{t.auth.registerBtn}</Link></>}>
      <ActionForm action={loginAction} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="next" value={next} />
        <label className="label">{t.auth.email}<input name="email" type="email" required autoComplete="email" className="input" /></label>
        <label className="label">{t.auth.password}<input name="password" type="password" required autoComplete="current-password" className="input" /></label>
        <Link href={`/${locale}/forgot`} className="self-end text-[14px]">{t.auth.forgot}</Link>
        <SubmitButton className="btn-navy w-full" pendingText={t.common.sending}>{t.auth.loginBtn}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
