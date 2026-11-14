import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getPage } from "@/lib/data";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { date, money } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function ContractView({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const t = getDict(locale);
  const user = await requireUser(locale);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, id), eq(s.applications.userId, user.id)), with: { course: true, group: true } });
  if (!app || !app.contractNo) notFound();
  const [st, page] = await Promise.all([getSettings(), getPage("contract")]);
  return (
    <article className="container-x max-w-[860px] pt-10 print:pt-0">
      <div className="mb-5 flex justify-end print:hidden"><PrintButton /></div>
      <div className="card p-8 sm:p-12 print:border-0 print:p-0">
        <h1 className="text-center font-serif text-[26px] font-bold text-navy-900">№ {app.contractNo}</h1>
        <table className="mt-6 w-full border-collapse text-[14.5px]">
          <tbody>
            {[
              [tr(st.legal.entity, locale), `${st.legal.tin} · ${st.contacts.email}`],
              [user.name, `${user.email}${user.phone ? ` · ${user.phone}` : ""}`],
              [tr(app.course.title, locale), `${app.course.code} · ${app.course.hours} ${t.course.hours} · ${app.format === "individual" ? t.format.individual : t.format.group}${app.group ? ` · ${date(app.group.startDate, locale)}` : app.startDate ? ` · ${date(app.startDate, locale)}` : ""}`],
              [app.plan === "full"
                ? `${t.enroll.full}: ${money(app.fullAmount ?? app.course.priceFull ?? 0, locale)}`
                : `${t.enroll.monthly}: ${money(app.monthlyAmount ?? app.course.priceMonthly, locale)} ${t.course.perMonth} × ${app.months ?? app.course.months}`, date(app.createdAt, locale)],
            ].map(([a, b], i) => <tr key={i} className="border-b border-[#eee7d8]"><td className="py-2.5 pr-4 font-semibold text-navy-900">{a}</td><td className="py-2.5 text-muted">{b}</td></tr>)}
          </tbody>
        </table>
        {page && <div className="prose-lg mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(tr(page.body, locale)) }} />}
      </div>
    </article>
  );
}
