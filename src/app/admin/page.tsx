import Link from "next/link";
import { desc, eq, gte, sql, and, gt, notInArray } from "drizzle-orm";
import { db, s } from "@/db";
import { money, dateShort } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { AdminCard, PageHead, badge, statusHy } from "@/components/admin/fields";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";
import { flowStage, type FlowKey } from "@/lib/admin-flow";

export default async function Dashboard() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [[apps], [pend], [paid], [active], [msgs]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(s.applications).where(eq(s.applications.status, "NEW")),
    db.select({ n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.status, "PENDING")),
    db.select({ n: sql<number>`coalesce(sum(${s.payments.amount}),0)::int` }).from(s.payments).where(and(eq(s.payments.status, "PAID"), gte(s.payments.paidAt, monthStart))),
    db.select({ n: sql<number>`count(*)::int` }).from(s.applications).where(eq(s.applications.status, "PAID")),
    db.select({ n: sql<number>`count(*)::int` }).from(s.messages).where(eq(s.messages.handled, false)),
  ]);
  const [settings, live, certRows, recent, [chats], [unanswered]] = await Promise.all([
    getSettings(),
    db.query.applications.findMany({ where: notInArray(s.applications.status, ["REJECTED", "CANCELLED"]), orderBy: [desc(s.applications.createdAt)], with: { user: true, course: true, group: true, payments: true } }),
    db.select({ userId: s.certificates.userId, courseId: s.certificates.courseId, revoked: s.certificates.revoked, receivedAt: s.certificates.receivedAt }).from(s.certificates),
    db.query.applications.findMany({ orderBy: [desc(s.applications.createdAt)], limit: 8, with: { user: true, course: true } }),
    db.select({ n: sql<number>`count(*)::int` }).from(s.chatThreads).where(and(eq(s.chatThreads.status, "open"), gt(s.chatThreads.adminUnread, 0))),
    db.select({ n: sql<number>`count(*)::int` }).from(s.messages).where(eq(s.messages.handled, false)),
  ]);
  const cfg = settings.payments;
  const activeApps = live.filter((a) => a.status === "PAID");
  const dues = activeApps.map((a) => ({ a, b: billing(a, a.course, a.group?.startDate, a.payments, cfg) }))
    .filter(({ b }) => b.next && b.daysLeft !== null && b.daysLeft <= 14)
    .sort((x, y) => (x.b.daysLeft ?? 0) - (y.b.daysLeft ?? 0));
  const expected = dues.filter(({ b }) => (b.daysLeft ?? 0) >= 0).reduce((n, { b }) => n + (b.next?.amount ?? 0), 0);
  // what needs the admin right now, in the order of the learner's journey
  const staged = live.map((a) => ({ a, g: flowStage(a, certRows.find((c) => c.userId === a.userId && c.courseId === a.courseId && !c.revoked)) }));
  const by = (k: FlowKey) => staged.filter((x) => x.g.key === k).map((x) => x.a);
  const overdue = dues.filter(({ b }) => (b.daysLeft ?? 0) < 0).map(({ a }) => a);
  type Todo = { title: string; hint: string; apps?: typeof live; n: number; href: string; cta: string };
  const todos: Todo[] = [
    { title: "Նոր հայտեր", hint: "Կապվեք և հրավիրեք մուտքային զրույցի", apps: by("NEW"), n: by("NEW").length, href: "/admin/applications?status=NEW", cta: "Հրավիրել" },
    { title: "Որոշում հարցազրույցից հետո", hint: "Հաստատեք կամ մերժեք", apps: by("INTERVIEW"), n: by("INTERVIEW").length, href: "/admin/applications?status=INTERVIEW", cta: "Որոշել" },
    { title: "Վճարված, բայց տվյալներ են պակասում", hint: "Նշեք խումբը, մեկնարկը կամ դասի հղումը", apps: by("SETUP"), n: by("SETUP").length, href: "/admin/applications?status=todo", cta: "Լրացնել" },
    { title: "Ավարտել են՝ վկայական տալ", hint: "Դասերն ավարտված են", apps: by("CERT"), n: by("CERT").length, href: "/admin/certificates", cta: "Տալ վկայական" },
    { title: "Ուշացած վճարումներ", hint: "Հիշեցումները գնում են ավտոմատ․ անհրաժեշտության դեպքում զանգեք", apps: overdue, n: overdue.length, href: "/admin/payments", cta: "Դիտել" },
    { title: "Չպատասխանված չատեր", hint: "Ունկնդիրները գրել են կայքի չատում", n: chats.n, href: "/admin/chats", cta: "Պատասխանել" },
    { title: "Կարծիքներ՝ հաստատման սպասող", hint: "Հաստատեք կամ մերժեք", n: pend.n, href: "/admin/reviews", cta: "Դիտել" },
    { title: "Չպատասխանված նամակներ («Կապ» ձևից)", hint: "", n: unanswered.n, href: "/admin/messages", cta: "Պատասխանել" },
  ].filter((x) => x.n > 0);
  const waiting = [
    { title: "Պայմանագիր չեն կնքել", n: by("SIGN").length },
    { title: "Կնքել են, սպասում ենք վճարմանը", n: by("PAY").length },
    { title: "Վկայականի ստացումը չեն հաստատել", n: by("RECEIPT").length },
  ].filter((x) => x.n > 0);
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
      <AdminCard title={todos.length ? `Անելիքներ · ${todos.reduce((n, x) => n + x.n, 0)}` : "Անելիքներ"} actions={<Link href="/admin/applications?status=todo" className="text-[14px] font-semibold">Բոլոր անելիքները →</Link>}>
        {todos.length === 0 ? <p className="m-0 text-[14.5px] text-[#1f5f33]">✓ Այս պահին անելիք չկա։ Նոր հայտերը, չատերը և վճարումները կհայտնվեն այստեղ։</p> : (
          <ul className="m-0 flex list-none flex-col p-0">
            {todos.map((x) => (
              <li key={x.title} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#eee7d8] py-3.5 first:border-t-0 first:pt-0">
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-gold-500 font-bold text-navy-950">{x.n}</span>
                <span className="min-w-0 flex-[1_1_220px]">
                  <b className="text-[15px] text-navy-900">{x.title}</b>
                  {x.hint && <span className="block text-[13px] text-muted">{x.hint}</span>}
                  {x.apps && x.apps.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {x.apps.slice(0, 5).map((a) => <Link key={a.id} href={`/admin/applications?open=${a.id}#app-${a.id}`} className="chip bg-ivory text-[13px] text-navy-800 no-underline hover:bg-sand">{a.user.name} · {a.course.code}</Link>)}
                      {x.apps.length > 5 && <span className="chip text-[13px] text-muted">+{x.apps.length - 5}</span>}
                    </span>
                  )}
                </span>
                <Link href={x.href} className="btn-navy min-h-10 px-4 text-[14px]">{x.cta}</Link>
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 0 && <p className="mt-4 mb-0 border-t border-[#eee7d8] pt-3 text-[13px] text-muted">Սպասում ենք ունկնդրին՝ {waiting.map((w) => `${w.title} (${w.n})`).join(" · ")}։ Կարող եք հիշեցնել հայտի քարտից։</p>}
      </AdminCard>
      <div className="h-6" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {kpi.map(([l, v, href]) => <Link key={l} href={href} className="card p-4 no-underline hover:shadow-md sm:p-5"><span className="text-[12.5px] leading-tight text-muted sm:text-[13px]">{l}</span><span className="mt-1 block font-serif text-[24px] sm:text-[28px] font-bold text-navy-900">{v}</span></Link>)}
      </div>
      <AdminCard title={`Սպասվող վճարումներ (14 օր) · ${money(expected)}`} actions={<span className="text-[13px] text-muted">Հիշեցումները գնում են ավտոմատ՝ {cfg.reminderDays} օր առաջ, վճարման օրը և ուշացման դեպքում</span>}>
        {dues.length === 0 ? <p className="text-muted">Առաջիկա 14 օրում վճարումներ չկան։</p> : (
          <div className="overflow-x-auto"><table className="rtable w-full min-w-[600px] border-collapse"><tbody>{dues.map(({ a, b }) => {
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
        <div className="overflow-x-auto"><table className="rtable w-full min-w-[600px] border-collapse">
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
