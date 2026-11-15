import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, like } from "drizzle-orm";
import { db, s } from "@/db";
import { fmt, getDict, type Locale } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmEmailAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmEmail({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  const { token = "" } = await searchParams;
  const t = getDict(locale);
  const [tk] = token ? await db.select().from(s.tokens).where(and(eq(s.tokens.token, token), like(s.tokens.type, "email:%"), gt(s.tokens.expiresAt, new Date()))).limit(1) : [];
  const footer = <Link href={`/${locale}/account#profile`} className="font-semibold">{t.account.profile}</Link>;
  if (!tk) return <AuthShell title={t.account.emailConfirmTitle} footer={footer}><p className="m-0 rounded-xl bg-[#fbefeb] px-4 py-3 text-[#8a2f1d]">{t.account.emailLinkInvalid}</p></AuthShell>;
  const newEmail = tk.type.slice("email:".length);
  return (
    <AuthShell title={t.account.emailConfirmTitle} footer={footer}>
      <p className="mt-0 mb-5 text-muted">{fmt(t.account.emailConfirmText, { email: newEmail })}</p>
      {/* A button (POST) instead of confirming on page load, so mail scanners that open links can't confirm it */}
      <ActionForm action={confirmEmailAction} successReplace className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="token" value={token} />
        <SubmitButton className="btn-navy w-full" pendingText={t.common.sending}>{t.account.emailConfirmBtn}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
