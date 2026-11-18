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
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:col-span-2 md:max-w-[460px]">
            <Field label="Ուսուցման սկիզբ" className="min-w-0"><input name="startDate" type="date" required className="input" /></Field>
            <Field label="Ուսուցման ավարտ" className="min-w-0"><input name="endDate" type="date" required className="input" /></Field>
          </div>
          <Field label="Համար (դատարկ՝ ավտոմատ, օր. ՖՎԾ-01/2027/001)"><input name="number" className="input font-mono" /></Field>
          <Field label="Անունը լատինատառ՝ անգլերեն վկայականի համար (դատարկ՝ ավտոմատ)"><input name="holderNameEn" placeholder="Yeva Sahakyan" className="input" /></Field>
          <Field label="Ավարտական նախագծի թեման (ներդիրի համար)"><input name="projectTopic" className="input" /></Field>
          <Field label="Նախագծի թեման անգլերեն (ներդիրի անգլերեն մասի համար)"><input name="projectTopicEn" className="input" /></Field>
          <Field label="Նախագծի հղումը"><input name="projectUrl" type="url" placeholder="https://" className="input" /></Field>
          <Field label="Հաճախումը, %"><input name="attendance" type="number" min={0} max={100} inputMode="numeric" className="input" /></Field>
          <Field label="Սկանավորված վկայական (PDF / նկար, ոչ պարտադիր)" className="md:col-span-2"><input type="file" name="file" accept="application/pdf,image/*" className="text-[14px]" /></Field>
          <div className="flex items-end"><SubmitButton pendingText="…">Տալ վկայական</SubmitButton></div>
        </ActionForm>
      </AdminCard>
      <div className="card mt-6 overflow-x-auto p-2">
        <table className="rtable w-full min-w-[820px] border-collapse">
          <thead><tr><th className={th}>Համար</th><th className={th}>Ունկնդիր</th><th className={th}>Դասընթաց</th><th className={th}>Ժամկետ</th><th className={th}>Տրված</th><th className={th}>Փաստաթղթեր</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id} className={c.revoked ? "opacity-60" : ""}>
              <td data-label="Համար" className={`${td} font-mono`}>{c.number}</td><td data-label="Ունկնդիր" className={td}>{c.holderName}</td><td data-label="Դասընթաց" className={td}>{c.course.code}</td>
              <td data-label="Ժամկետ" className={td}>{dateShort(c.startDate)} – {dateShort(c.endDate)}</td><td data-label="Տրված" className={td}>{dateShort(c.issuedAt)}</td>
              <td data-label="Փաստաթղթեր" className={td}>
                <div className="flex flex-col items-start gap-2">
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold">
                    <a href={`/hy/account/certificate/${c.id}/hy`} target="_blank" rel="noopener">Հայերեն</a>
                    <a href={`/hy/account/certificate/${c.id}/en`} target="_blank" rel="noopener">English</a>
                    <a href={`/hy/account/certificate/${c.id}/insert`} target="_blank" rel="noopener">Ներդիր</a>
                    {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noopener noreferrer">Սկան</a>}
                  </span>
                  <details className="w-full">
                    <summary className="cursor-pointer text-[13px] text-muted">Խմբագրել տվյալները{c.revoked ? " · չեղարկված" : ""}</summary>
                    <form action={updateCertificate} className="mt-2 grid w-full max-w-[420px] gap-2.5 text-left">
                      <input type="hidden" name="id" value={c.id} />
                      <label className="label text-[13px]">Անուն, ազգանուն, հայրանուն<input name="holderName" defaultValue={c.holderName} className="input min-h-10" /></label>
                      <label className="label text-[13px]">Լատինատառ (անգլերեն)<input name="holderNameEn" defaultValue={c.holderNameEn ?? ""} placeholder="ավտոմատ" className="input min-h-10" /></label>
                      <label className="label text-[13px]">Նախագծի թեման<input name="projectTopic" defaultValue={c.projectTopic ?? ""} className="input min-h-10" /></label>
                      <label className="label text-[13px]">Թեման անգլերեն<input name="projectTopicEn" defaultValue={c.projectTopicEn ?? ""} className="input min-h-10" /></label>
                      <div className="grid grid-cols-[1fr_96px] gap-2.5">
                        <label className="label min-w-0 text-[13px]">Նախագծի հղումը<input name="projectUrl" defaultValue={c.projectUrl ?? ""} className="input min-h-10" /></label>
                        <label className="label min-w-0 text-[13px]">Հաճախում %<input name="attendance" type="number" min={0} max={100} defaultValue={c.attendance ?? ""} className="input min-h-10" /></label>
                      </div>
                      <label className="label text-[13px]">Սկանավորված ֆայլ<input type="file" name="file" accept="application/pdf,image/*" className="text-[12px]" /></label>
                      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="revoked" defaultChecked={c.revoked} />Չեղարկված</label>
                      <button className="btn-navy min-h-10 justify-self-start px-5 text-[13.5px]">Պահպանել</button>
                    </form>
                  </details>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {list.length === 0 && <p className="p-4 text-muted">Վկայականներ դեռ չեն տրվել։</p>}
      </div>
    </>
  );
}
