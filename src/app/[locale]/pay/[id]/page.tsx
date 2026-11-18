import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ValueButton } from "@/components/ValueButton";
import { and, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDict, type Locale } from "@/lib/i18n";
import { money } from "@/lib/format";
import { ameriaEnabled, idramEnabled, testPaymentsAllowed } from "@/lib/payments";
import { idramForm } from "@/lib/payments/idram";
import { ameriaInit } from "@/lib/payments/ameria";
import { siteUrl } from "@/lib/seo";
import { AutoSubmit } from "./AutoSubmit";
import { simulateAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function Pay({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const user = await requireUser(locale);
  const t = getDict(locale);
  const [p] = await db.select().from(s.payments).where(and(eq(s.payments.id, id), eq(s.payments.userId, user.id))).limit(1);
  if (!p) notFound();
  if (p.status !== "PENDING") redirect(`/${locale}/pay/result?id=${p.id}`);

  if (p.method === "IDRAM" && idramEnabled()) {
    const f = idramForm({ orderNo: p.orderNo, amount: p.amount, description: p.description, email: user.email, locale });
    return (
      <div className="container-x max-w-[560px] py-20 text-center">
        <AutoSubmit action={f.action} fields={f.fields} label={`Idram · ${money(p.amount, locale)}`} />
      </div>
    );
  }
  if (p.method === "CARD" && ameriaEnabled()) {
    let url: string;
    try {
      const r = await ameriaInit({ orderNo: p.orderNo, amount: p.amount, description: p.description, backUrl: `${siteUrl()}/api/payments/ameria?locale=${locale}`, locale });
      await db.update(s.payments).set({ providerRef: r.paymentId }).where(eq(s.payments.id, p.id));
      url = r.redirectUrl;
    } catch (e) {
      console.error(e);
      redirect(`/${locale}/pay/result?id=${p.id}&e=1`);
    }
    redirect(url);
  }
  if (!testPaymentsAllowed(user.role)) redirect(`/${locale}/pay/result?id=${p.id}&e=1`);

  return (
    <div className="container-x max-w-[620px] py-20">
      <div className="card p-9 text-center">
        <span className="chip bg-[#fbf2dd] font-semibold text-[#7a5a12]">TEST</span>
        <h1 className="mt-4 font-serif text-[28px] font-bold text-navy-900">{t.pay.testTitle}</h1>
        <p className="mt-2 text-muted">{t.pay.testText}</p>
        <p className="mt-5 font-serif text-[30px] font-bold text-navy-900">{money(p.amount, locale)}</p>
        <p className="text-[14px] text-muted">{p.description}</p>
        <form action={simulateAction} className="mt-7 flex flex-wrap justify-center gap-3">
          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="locale" value={locale} />
          <ValueButton name="result" value="ok" className="btn-navy">{t.pay.simulateOk}</ValueButton>
          <ValueButton name="result" value="fail" className="btn-soft">{t.pay.simulateFail}</ValueButton>
        </form>
      </div>
    </div>
  );
}
