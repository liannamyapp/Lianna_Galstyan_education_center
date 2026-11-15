import { asc, desc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Field, L10nInput, PageHead, badge, statusHy } from "@/components/admin/fields";
import { deleteGroup, saveGroup } from "../actions";

type G = typeof s.groups.$inferSelect;
const iso = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function GroupForm({ g, courses }: { g?: G; courses: { id: string; label: string }[] }) {
  return (
    <ActionForm action={saveGroup} resetOnSuccess={!g} className="flex flex-col gap-4">
      {g && <input type="hidden" name="id" value={g.id} />}
      <div className="grid gap-4 md:grid-cols-5">
        <Field label="Դասընթաց"><select name="courseId" required defaultValue={g?.courseId} className="input">{courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        <Field label="Խմբի անվանում"><input name="name" defaultValue={g?.name} placeholder="ՖՎԾ-01 · Գարուն 2027" className="input" /></Field>
        <Field label="Մեկնարկ"><input name="startDate" type="date" required defaultValue={iso(g?.startDate)} className="input" /></Field>
        <Field label="Տեղեր"><input name="seats" type="number" min={1} defaultValue={g?.seats ?? 12} className="input" /></Field>
        <Field label="Կարգավիճակ"><select name="status" defaultValue={g?.status ?? "OPEN"} className="input">{(["OPEN", "FULL", "RUNNING", "FINISHED"] as const).map((x) => <option key={x} value={x}>{statusHy[x]}</option>)}</select></Field>
      </div>
      <L10nInput name="schedule" label="Դասացուցակ (օր.՝ Երկ, Չրք, Ուրբ · 19:00–20:30)" value={g?.schedule} required />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Դասի հղում (Zoom / Meet) — երևում է միայն ակտիվ ունկնդիրներին"><input name="meetingUrl" type="url" defaultValue={g?.meetingUrl ?? ""} className="input" /></Field>
        <Field label="Ձայնագրությունների հղում"><input name="recordingsUrl" type="url" defaultValue={g?.recordingsUrl ?? ""} className="input" /></Field>
      </div>
      <SubmitButton className="btn-navy self-start" pendingText="…">{g ? "Պահպանել" : "Ստեղծել խումբ"}</SubmitButton>
    </ActionForm>
  );
}

export default async function Groups() {
  const courses = (await db.select().from(s.courses).orderBy(asc(s.courses.order))).map((c) => ({ id: c.id, label: `${c.code} · ${tr(c.title, "hy")}` }));
  const list = await db.query.groups.findMany({ orderBy: [desc(s.groups.startDate)], with: { course: true, applications: true } });
  return (
    <>
      <PageHead title="Խմբեր և դասացուցակ" />
      <AdminCard title="+ Նոր խումբ"><GroupForm courses={courses} /></AdminCard>
      <div className="mt-6 flex flex-col gap-3">
        {list.map((g) => (
          <details key={g.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <b className="min-w-0 flex-1 break-words">{g.name}</b><span className="font-mono text-[13px]">{g.course.code}</span><span className="text-[14px]">{dateShort(g.startDate)}</span>
              <span className="text-[13px] text-muted">{g.applications.filter((a) => ["APPROVED", "PAID"].includes(a.status)).length} / {g.seats}</span>
              <span className={`chip font-semibold ${badge[g.status]}`}>{statusHy[g.status]}</span>
            </summary>
            <div className="border-t border-[#eee7d8] p-5">
              <GroupForm g={g} courses={courses} />
              <form action={deleteGroup} className="mt-3"><input type="hidden" name="id" value={g.id} /><button className="text-[13px] text-[#8a2f1d]">Ջնջել խումբը</button></form>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
