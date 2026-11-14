import Link from "next/link";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDict, type Locale } from "@/lib/i18n";
import { money } from "@/lib/format";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function Result({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ id?: string; e?: string; EDP_BILL_NO?: string }> }) {
  const { locale } = await params;
  const { id, e, EDP_BILL_NO } = await searchParams;
  const user = await requireUser(locale);
  const t = getDict(locale);
  const bill = Number(EDP_BILL_NO); // Idram returns the order number on its success/fail redirect
  const where = id ? eq(s.payments.id, id) : Number.isFinite(bill) && bill > 0 ? eq(s.payments.orderNo, bill) : null;
  const [p] = where ? await db.select().from(s.payments).where(and(where, eq(s.payments.userId, user.id))).limit(1) : [];
  const state = p?.status === "PAID" ? "ok" : p?.status === "FAILED" || e ? "fail" : "pending";
  const view = {
    ok: { icon: "check", tone: "bg-[#e3f1e6] text-[#1f5f33]", title: t.pay.successTitle, text: t.pay.successText },
    fail: { icon: "close", tone: "bg-[#fbefeb] text-[#8a2f1d]", title: t.pay.failTitle, text: t.pay.failText },
    pending: { icon: "calendar", tone: "bg-[#fbf2dd] text-[#7a5a12]", title: t.pay.pendingTitle, text: t.pay.pendingText },
  }[state];
  return (
    <div className="container-x max-w-[620px] py-20">
      <div className="card p-9 text-center" role="status">
        <span className={`mx-auto flex size-16 items-center justify-center rounded-full ${view.tone}`}><Icon name={view.icon} size={30} strokeWidth={2.4} /></span>
        <h1 className="mt-5 font-serif text-[28px] font-bold text-navy-900">{view.title}</h1>
        <p className="mt-2 text-muted">{view.text}</p>
        {p && <p className="mt-4 text-[15px]"><b>{money(p.amount, locale)}</b> · {p.description}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}/account`} className="btn-navy">{t.pay.toAccount}</Link>
          {state === "fail" && <Link href={`/${locale}/courses`} className="btn-soft">{t.pay.tryAgain}</Link>}
        </div>
      </div>
    </div>
  );
}
