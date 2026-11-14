import { asc, desc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, Field, L10nInput, PageHead } from "@/components/admin/fields";
import { UploadField } from "@/components/admin/UploadField";
import { deleteLesson, saveLesson } from "../actions";

export const dynamic = "force-dynamic";
type L = typeof s.lessons.$inferSelect;
type Opt = { value: string; label: string };
const iso = (d?: Date | null) => (d ? new Date(new Date(d).getTime() + 4 * 3_600_000).toISOString().slice(0, 10) : ""); // Yerevan date

function LessonForm({ l, courseId, audiences, modules, blob }: { l?: L; courseId: string; audiences: Opt[]; modules: string[]; blob: boolean }) {
  const aud = l?.userId ? `u:${l.userId}` : l?.groupId ? `g:${l.groupId}` : "all";
  return (
    <ActionForm action={saveLesson} resetOnSuccess={!l} className="flex flex-col gap-4">
      {l && <input type="hidden" name="id" value={l.id} />}
      <input type="hidden" name="courseId" value={courseId} />
      <L10nInput name="title" label="Դասի վերնագիր" value={l?.title} required hint="Բավական է լրացնել հայերենը. մյուս լեզուներով դատարկ դաշտերի փոխարեն կցուցադրվի հայերենը։" />
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Ում համար" className="md:col-span-2"><select name="audience" defaultValue={aud} className="input">{audiences.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <Field label="Մոդուլ"><select name="moduleCode" defaultValue={l?.moduleCode ?? ""} className="input"><option value="">—</option>{modules.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
        <Field label="Դասի ամսաթիվ"><input name="lessonDate" type="date" defaultValue={iso(l?.lessonDate) || (l ? "" : iso(new Date()))} className="input" /></Field>
      </div>
      <UploadField name="videoUrl" label="Տեսանյութ" defaultValue={l?.videoUrl} accept="video/*" blob={blob}
        hint="YouTube (Unlisted), Vimeo, Google Drive կամ վերբեռնված ֆայլ։ Google Drive-ի և վերբեռնված ֆայլերի դեպքում ունկնդիրը կկարողանա նաև ներբեռնել տեսանյութը։" />
      <UploadField name="materialsUrl" label="Նյութեր (PDF, ZIP, կոդ, ոչ պարտադիր)" defaultValue={l?.materialsUrl} accept=".pdf,.zip,image/*" blob={blob} />
      <div className="flex flex-wrap items-end gap-5">
        <label className="label w-[130px]">Հերթականություն<input name="order" type="number" defaultValue={l?.order ?? 0} className="input" /></label>
        <Check name="published" label="Հրապարակված" defaultChecked={l?.published ?? true} />
        {!l && <Check name="notify" label="Էլ. նամակով ծանուցել ունկնդիրներին" defaultChecked />}
        <SubmitButton className="btn-navy" pendingText="…">{l ? "Պահպանել" : "Ավելացնել դաս"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function Lessons({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const courses = await db.select().from(s.courses).orderBy(asc(s.courses.order));
  const { c } = await searchParams;
  const course = courses.find((x) => x.id === c) ?? courses[0];
  if (!course) return <><PageHead title="Տեսադասեր" /><p className="text-muted">Նախ ստեղծեք դասընթաց։</p></>;
  const [groups, apps, mods, list] = await Promise.all([
    db.select().from(s.groups).where(eq(s.groups.courseId, course.id)).orderBy(desc(s.groups.startDate)),
    db.query.applications.findMany({ where: eq(s.applications.courseId, course.id), with: { user: true } }),
    db.select().from(s.courseModules).where(eq(s.courseModules.courseId, course.id)).orderBy(asc(s.courseModules.order)),
    db.query.lessons.findMany({ where: eq(s.lessons.courseId, course.id), orderBy: [desc(s.lessons.lessonDate), desc(s.lessons.createdAt)], with: { group: true, user: true } }),
  ]);
  const audiences: Opt[] = [
    { value: "all", label: "Դասընթացի բոլոր ունկնդիրները" },
    ...groups.map((g) => ({ value: `g:${g.id}`, label: `Խումբ՝ ${g.name} (${dateShort(g.startDate)})` })),
    ...apps.filter((a) => a.format === "individual" && a.status === "PAID").map((a) => ({ value: `u:${a.userId}`, label: `Անհատական՝ ${a.user.name}` })),
  ];
  const modules = mods.map((m) => m.code);
  const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return (
    <>
      <PageHead title="Տեսադասեր" />
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Դասընթաց">
        {courses.map((x) => <a key={x.id} href={`/admin/lessons?c=${x.id}`} className={`chip min-h-10 px-4 no-underline ${x.id === course.id ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>{x.code} · {tr(x.title, "hy")}</a>)}
      </nav>
      <p className="-mt-2 mb-5 text-[14px] text-muted">Դասերը երևում են միայն վճարած ունկնդիրներին՝ իրենց անձնական էջում։ Եթե վճարումն ուշանում է, մուտքը ինքնաբերաբար դադարեցվում է և վերականգնվում է վճարումից հետո։{!blob && " Ֆայլեր ուղղակիորեն վերբեռնելու համար Vercel-ում միացրեք Blob պահոցը (տե՛ս README). մինչ այդ օգտագործեք YouTube/Drive հղումներ։"}</p>
      <AdminCard title="+ Նոր տեսադաս"><LessonForm courseId={course.id} audiences={audiences} modules={modules} blob={blob} /></AdminCard>
      <div className="mt-6 flex flex-col gap-3">
        {list.map((l) => (
          <details key={l.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <span className="w-10 font-mono text-[13px] text-gold-700">{l.moduleCode ?? "—"}</span>
              <b className="min-w-[200px] flex-1 text-navy-900">{tr(l.title, "hy")}</b>
              <span className="text-[13px] text-muted">{l.user ? `Անհատական՝ ${l.user.name}` : l.group ? l.group.name : "Բոլորը"}</span>
              <span className="text-[13px] text-muted">{dateShort(l.lessonDate)}</span>
              {!l.published && <span className="chip bg-[#eef0f3] text-[#4b5563]">Թաքցված</span>}
            </summary>
            <div className="border-t border-[#eee7d8] p-5">
              <LessonForm l={l} courseId={course.id} audiences={audiences} modules={modules} blob={blob} />
              <form action={deleteLesson} className="mt-3"><input type="hidden" name="id" value={l.id} /><button className="text-[13px] text-[#8a2f1d]">Ջնջել դասը</button></form>
            </div>
          </details>
        ))}
        {list.length === 0 && <p className="card p-6 text-muted">Այս դասընթացում տեսադասեր դեռ չկան։</p>}
      </div>
    </>
  );
}
