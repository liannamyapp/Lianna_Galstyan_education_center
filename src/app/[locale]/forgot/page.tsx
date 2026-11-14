import type { Metadata } from "next";
import { getDict, type Locale } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { forgotAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function Forgot({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDict(locale);
  return (
    <AuthShell title={t.auth.forgotTitle}>
      <p className="-mt-2 mb-5 text-muted">{t.auth.forgotText}</p>
      <ActionForm action={forgotAction} successReplace className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="label">{t.auth.email}<input name="email" type="email" required autoComplete="email" className="input" /></label>
        <SubmitButton className="btn-navy w-full" pendingText={t.common.sending}>{t.auth.sendLink}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
