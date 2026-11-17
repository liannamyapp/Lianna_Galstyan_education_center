import { asc, desc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Field, PageHead, th, td } from "@/components/admin/fields";
import { issueCertificate, updateCertificate } from "../actions";

export default async function Certificates() {
  const courses = await db.select().from(s.courses).orderBy(asc(s.courses.order));
  const students = await db.query.applications.findMany({ where: eq(s.applications.status, "PAID"), with: { user: true, course: true } });
  const list = await db.query.certificates.findMany({ orderBy: [desc(s.certificates.issuedAt)], with: { course: true } });
  return (
    <>
      <PageHead title="Վկայականներ (էլեկտրոնային մատյան)" />
      <AdminCard title="Տալ վկայական">
        <ActionForm action={issueCertificate} resetOnSuccess className="grid gap-4 md:grid-cols-3">
          <Field label="Ունկնդիր (ակտիվներից)"><select name="userId" className="input"><option value="">— ձեռքով մուտքագրել ներքևում —</option>{students.map((a) => <option key={a.id} value={a.userId}>{a.user.name} · {a.course.code}</option>)}</select></Field>
          <Field label="Կամ անուն, ազգանուն (ինչպես վկայականում)"><input name="holderName" className="input" /></Field>
          <Field label="Դասընթաց"><select name="courseId" required className="input">{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {tr(c.title, "hy")}</option>)}</select></Field>
          <Field label="Ուսուցման սկիզբ"><input name="startDate" type="date" required className="input" /></Field>
          <Field label="Ուսուցման ավարտ"><input name="endDate" type="date" required className="input" /></Field>
          <Field label="Համար (դատարկ՝ ավտոմատ, օր. ՖՎԾ-01/2027/001)"><input name="number" className="input font-mono" /></Field>
          <Field label="Սկանավորված վկայական (PDF / նկար, ոչ պարտադիր)" className="md:col-span-2"><input type="file" name="file" accept="application/pdf,image/*" className="text-[14px]" /></Field>
          <div className="flex items-end"><SubmitButton pendingText="…">Տալ վկայական</SubmitButton></div>
        </ActionForm>
      </AdminCard>
      <div className="card mt-6 overflow-x-auto p-2">
        <table className="rtable w-full min-w-[820px] border-collapse">
          <thead><tr><th className={th}>Համար</th><th className={th}>Ունկնդիր</th><th className={th}>Դասընթաց</th><th className={th}>Ժամկետ</th><th className={th}>Տրված</th><th className={th}>Ֆայլ / կարգավիճակ</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id} className={c.revoked ? "opacity-60" : ""}>
              <td data-label="Համար" className={`${td} font-mono`}>{c.number}</td><td data-label="Ունկնդիր" className={td}>{c.holderName}</td><td data-label="Դասընթաց" className={td}>{c.course.code}</td>
              <td data-label="Ժամկետ" className={td}>{dateShort(c.startDate)} – {dateShort(c.endDate)}</td><td data-label="Տրված" className={td}>{dateShort(c.issuedAt)}</td>
              <td data-label="Ֆայլ / կարգավիճակ" className={td}>
                <form action={updateCertificate} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[13px]">Ֆայլ</a>}
                  <input type="file" name="file" accept="application/pdf,image/*" className="w-[170px] text-[12px]" aria-label="Ֆայլ" />
                  <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="revoked" defaultChecked={c.revoked} />Չեղարկված</label>
                  <button className="text-[13px] font-semibold text-navy-800">OK</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {list.length === 0 && <p className="p-4 text-muted">Վկայականներ դեռ չեն տրվել։</p>}
      </div>
    </>
  );
}
