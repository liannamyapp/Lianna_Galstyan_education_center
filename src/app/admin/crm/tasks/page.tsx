import Link from "next/link";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { db, s } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, PageHead } from "@/components/admin/fields";
import { LeadLink, relTime } from "@/components/admin/crm";
import { dateShort } from "@/lib/format";
import { saveTask, toggleTask } from "../actions";

type Task = typeof s.crmTasks.$inferSelect & { lead: typeof s.leads.$inferSelect | null };

function List({ items, empty }: { items: Task[]; empty: string }) {
  if (!items.length) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-[14px]">
          <form action={toggleTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.done ? "0" : "1"} /><button aria-label={t.done ? "Վերաբացել" : "Կատարված"} className={`flex size-7 items-center justify-center rounded-full border-2 ${t.done ? "border-[#2f7a46] bg-[#2f7a46] text-white" : "border-navy-800 text-navy-800 hover:bg-navy-800 hover:text-white"}`}>✓</button></form>
          <span className={`min-w-0 flex-1 ${t.done ? "text-muted line-through" : ""}`}>{t.title}{t.auto && <span className="ml-2 chip bg-[#f3f1ec] text-[11.5px] text-muted">ավտոմատ</span>}{t.lead && <> · <LeadLink id={t.lead.id} name={t.lead.name} /></>}</span>
          <span className={`text-[12.5px] ${!t.done && t.dueAt.getTime() < Date.now() ? "font-semibold text-[#8a2f1d]" : "text-muted"}`}>{dateShort(t.dueAt)} · {relTime(t.dueAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function Tasks() {
  const endToday = new Date(); endToday.setUTCHours(20, 0, 0, 0); // 24:00 in Yerevan
  if (endToday.getTime() < Date.now()) endToday.setTime(endToday.getTime() + 86_400_000);
  const [today, upcoming, done] = await Promise.all([
    db.query.crmTasks.findMany({ where: and(eq(s.crmTasks.done, false), lte(s.crmTasks.dueAt, endToday)), with: { lead: true }, orderBy: [asc(s.crmTasks.dueAt)] }),
    db.query.crmTasks.findMany({ where: and(eq(s.crmTasks.done, false), gt(s.crmTasks.dueAt, endToday)), with: { lead: true }, orderBy: [asc(s.crmTasks.dueAt)], limit: 100 }),
    db.query.crmTasks.findMany({ where: eq(s.crmTasks.done, true), with: { lead: true }, orderBy: [desc(s.crmTasks.doneAt)], limit: 30 }),
  ]);
  return (
    <>
      <PageHead title="Առաջադրանքներ"><Link href="/admin/crm/board" className="btn-soft min-h-11">Խողովակ</Link></PageHead>
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title={`Այսօր և ուշացած · ${today.length}`}><List items={today} empty="Այսօրվա համար ոչինչ չկա 🎉" /></AdminCard>
        <AdminCard title="Նոր առաջադրանք (առանց լիդի)">
          <ActionForm action={saveTask} className="grid gap-3" resetOnSuccess>
            <label className="label">Ինչ անել<input name="title" required className="input" placeholder="օր.՝ պատրաստել Instagram-ի գովազդը" /></label>
            <label className="label">Երբ<input name="dueAt" type="datetime-local" className="input" /></label>
            <div><SubmitButton>Ավելացնել</SubmitButton></div>
          </ActionForm>
        </AdminCard>
        <AdminCard title={`Առաջիկա · ${upcoming.length}`}><List items={upcoming} empty="Առաջիկա առաջադրանքներ չկան" /></AdminCard>
        <AdminCard title="Վերջերս կատարված"><List items={done} empty="Դեռ ոչինչ" /></AdminCard>
      </div>
    </>
  );
}
