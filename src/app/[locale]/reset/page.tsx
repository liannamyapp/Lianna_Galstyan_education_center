import type { Metadata } from "next";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { resetAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function Reset({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  const { token = "" } = await searchParams;
  const t = getDict(locale);
  return (
    <AuthShell title={t.auth.resetTitle} footer={<Link href={`/${locale}/login`} className="font-semibold">{t.auth.loginBtn}</Link>}>
      <ActionForm action={resetAction} successReplace className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="token" value={token} />
        <label className="label">{t.auth.password}<input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /><span className="font-normal text-muted">{t.auth.passwordHint}</span></label>
        <SubmitButton className="btn-navy w-full" pendingText={t.common.sending}>{t.auth.resetBtn}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
