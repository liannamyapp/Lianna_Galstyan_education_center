import Link from "next/link";
import { desc, eq, gte, sql, and } from "drizzle-orm";
import { db, s } from "@/db";
import { money, dateShort } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { AdminCard, PageHead, badge, statusHy } from "@/components/admin/fields";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";

export default async function Dashboard() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [[apps], [pend], [paid], [active], [msgs]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(s.applications).where(eq(s.applications.status, "NEW")),
    db.select({ n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.status, "PENDING")),
    db.select({ n: sql<number>`coalesce(sum(${s.payments.amount}),0)::int` }).from(s.payments).where(and(eq(s.payments.status, "PAID"), gte(s.payments.paidAt, monthStart))),
    db.select({ n: sql<number>`count(*)::int` }).from(s.applications).where(eq(s.applications.status, "PAID")),
    db.select({ n: sql<number>`count(*)::int` }).from(s.messages).where(eq(s.messages.handled, false)),
  ]);
  const cfg = (await getSettings()).payments;
  const activeApps = await db.query.applications.findMany({ where: eq(s.applications.status, "PAID"), with: { user: true, course: true, group: true, payments: true } });
  const dues = activeApps.map((a) => ({ a, b: billing(a, a.course, a.group?.startDate, a.payments, cfg) }))
    .filter(({ b }) => b.next && b.daysLeft !== null && b.daysLeft <= 14)
    .sort((x, y) => (x.b.daysLeft ?? 0) - (y.b.daysLeft ?? 0));
  const expected = dues.filter(({ b }) => (b.daysLeft ?? 0) >= 0).reduce((n, { b }) => n + (b.next?.amount ?? 0), 0);
  const recent = await db.query.applications.findMany({ orderBy: [desc(s.applications.createdAt)], limit: 8, with: { user: true, course: true } });
  const kpi = [
    ["Նոր հայտեր", apps.n, "/admin/applications?status=NEW"], ["Կարծիքներ՝ սպասող", pend.n, "/admin/reviews"],
    ["Վճարումներ այս ամիս", money(paid.n), "/admin/payments"], ["Ակտիվ ունկնդիրներ", active.n, "/admin/applications?status=PAID"], ["Չպատասխանված նամակներ", msgs.n, "/admin/messages"],
  ] as const;
  return (
    <>
      <PageHead title="Վահանակ">
        <Link href="/admin/groups" className="btn-soft min-h-11">+ Նոր խումբ</Link>
        <Link href="/admin/courses/new" className="btn-navy min-h-11">+ Նոր դասընթաց</Link>
      </PageHead>
      <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {kpi.map(([l, v, href]) => <Link key={l} href={href} className="card p-5 no-underline hover:shadow-md"><span className="text-[13px] text-muted">{l}</span><span className="mt-1 block font-serif text-[28px] font-bold text-navy-900">{v}</span></Link>)}
      </div>
      <AdminCard title={`Սպասվող վճարումներ (14 օր) · ${money(expected)}`} actions={<span className="text-[13px] text-muted">Հիշեցումները գնում են ավտոմատ՝ {cfg.reminderDays} օր առաջ, վճարման օրը և ուշացման դեպքում</span>}>
        {dues.length === 0 ? <p className="text-muted">Առաջիկա 14 օրում վճարումներ չկան։</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] border-collapse"><tbody>{dues.map(({ a, b }) => {
            const d = b.daysLeft ?? 0;
            return (
              <tr key={a.id} className="border-t border-[#eee7d8] text-[14px]">
                <td className="py-3 pr-3"><b>{a.user.name}</b><br /><span className="text-muted">{a.user.phone ?? a.user.email}</span></td>
                <td className="py-3 pr-3 font-mono text-[13px]">{a.course.code} · {a.format === "individual" ? "անհատ." : "խումբ"}</td>
                <td className="py-3 pr-3">{money(b.next!.amount)}<br /><span className="text-muted">{b.next!.index + 1}/{b.months} · {dateShort(b.next!.due)}</span></td>
                <td className="py-3"><span className={`chip font-semibold ${d < -cfg.graceDays ? "bg-[#8a2f1d] text-white" : d <= 0 ? "bg-[#fbefeb] text-[#8a2f1d]" : d <= cfg.reminderDays ? "bg-[#fbf2dd] text-[#7a5a12]" : "bg-[#e3f1e6] text-[#1f5f33]"}`}>{d > 0 ? `${d} օրից` : d === 0 ? "այսօր" : `ուշացում ${-d} օր`}</span></td>
              </tr>
            );
          })}</tbody></table></div>
        )}
      </AdminCard>
      <div className="h-6" />
      <AdminCard title="Վերջին հայտեր" actions={<Link href="/admin/applications" className="text-[14px] font-semibold">Բոլորը →</Link>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] border-collapse">
          <tbody>{recent.map((a) => (
            <tr key={a.id} className="border-t border-[#eee7d8] text-[14px]">
              <td className="py-3 pr-3"><b>{a.user.name}</b><br /><span className="text-muted">{a.user.email} · {a.user.phone}</span></td>
              <td className="py-3 pr-3 font-mono text-[13px]">{a.course.code}<br /><span className="font-sans text-muted">{tr(a.course.title, "hy")}</span></td>
              <td className="py-3 pr-3 text-muted">{dateShort(a.createdAt)}</td>
              <td className="py-3"><span className={`chip font-semibold ${badge[a.status]}`}>{statusHy[a.status]}</span></td>
            </tr>
          ))}</tbody>
        </table>{recent.length === 0 && <p className="text-muted">Հայտեր դեռ չկան։</p>}</div>
      </AdminCard>
    </>
  );
}
