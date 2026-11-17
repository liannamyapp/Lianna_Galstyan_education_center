import Link from "next/link";
import { desc, eq, asc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort, money } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHead, badge, statusHy, Check } from "@/components/admin/fields";
import { updateApplication } from "../actions";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";

const STATUSES = ["NEW", "INTERVIEW", "APPROVED", "PAID", "REJECTED", "CANCELLED"] as const;

export default async function Applications({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const st = STATUSES.find((x) => x === status);
  const list = await db.query.applications.findMany({
    where: st ? eq(s.applications.status, st) : undefined, orderBy: [desc(s.applications.createdAt)], limit: 200,
    with: { user: true, course: true, group: true, payments: true },
  });
  const groups = await db.select().from(s.groups).orderBy(asc(s.groups.startDate));
  const cfg = (await getSettings()).payments;
  const stateHy = { unpaid: "Չվճարված", upcoming: "Ժամանակին", soon: "Մոտենում է", due: "Վճարման օր", overdue: "Ուշացում · մուտքը դադարեցված", done: "Ամբողջությամբ վճարված" } as const;
  const stateCls = { unpaid: "bg-[#eef0f3] text-[#4b5563]", upcoming: "bg-[#e3f1e6] text-[#1f5f33]", soon: "bg-[#fbf2dd] text-[#7a5a12]", due: "bg-[#fbefeb] text-[#8a2f1d]", overdue: "bg-[#8a2f1d] text-white", done: "bg-[#e3f1e6] text-[#1f5f33]" } as const;
  const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return (
    <>
      <PageHead title="Հայտեր" />
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Ֆիլտր">
        <Link href="/admin/applications" className={`chip min-h-10 px-4 no-underline ${!st ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>Բոլորը</Link>
        {STATUSES.map((x) => <Link key={x} href={`/admin/applications?status=${x}`} className={`chip min-h-10 px-4 no-underline ${st === x ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>{statusHy[x]}</Link>)}
      </nav>
      <div className="flex flex-col gap-3">
        {list.map((a) => {
          const paid = a.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amount, 0);
          const b = billing(a, a.course, a.group?.startDate, a.payments, cfg);
          return (
            <details key={a.id} className="card group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 p-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-[200px] flex-1"><b className="text-navy-900">{a.user.name}</b><br /><span className="text-[13px] text-muted">{a.user.email} · {a.user.phone ?? "—"}</span></span>
                <span className="font-mono text-[13px]">{a.course.code}</span>
                <span className={`chip font-semibold ${a.format === "individual" ? "bg-[#fbf2dd] text-[#7a5a12]" : "bg-[#e6eef8] text-navy-800"}`}>{a.format === "individual" ? "Անհատական" : "Խմբակային"}</span>
                <span className="text-[13px] text-muted">{a.plan === "full" ? "Ամբողջ" : `Ամսական · ${b.paidCount}/${b.months}`} · վճարված {money(paid)}</span>
                {a.status === "PAID" && <span className={`chip font-semibold ${stateCls[b.state]}`}>{stateHy[b.state]}{b.next?.due && b.state !== "done" ? ` · ${dateShort(b.next.due)}` : ""}</span>}
                <span className="text-[13px] text-muted">{dateShort(a.createdAt)}</span>
                <span className={`chip font-semibold ${a.contractSignedAt ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#fdf3e1] text-[#8a5a2b]"}`}>{a.contractSignedAt ? `Պայմանագիրը կնքված է ${dateShort(a.contractSignedAt)}` : "Պայմանագիրը չի կնքվել"}</span>
                <span className={`chip font-semibold ${badge[a.status]}`}>{statusHy[a.status]}</span>
              </summary>
              <ActionForm action={updateApplication} className="grid gap-4 border-t border-[#eee7d8] p-5 md:grid-cols-2">
                <input type="hidden" name="id" value={a.id} />
                {a.note && <p className="m-0 rounded-xl bg-ivory p-3 text-[14px] md:col-span-2"><b>Ունկնդրի մեկնաբանություն՝</b> {a.note}</p>}
                <label className="label">Կարգավիճակ<select name="status" defaultValue={a.status} className="input">{STATUSES.map((x) => <option key={x} value={x}>{statusHy[x]}</option>)}</select></label>
                <label className="label">Խումբ<select name="groupId" defaultValue={a.groupId ?? ""} className="input"><option value="">—</option>{groups.filter((g) => g.courseId === a.courseId).map((g) => <option key={g.id} value={g.id}>{g.name} · {dateShort(g.startDate)}</option>)}</select></label>
                <label className="label">Ձևաչափ<select name="format" defaultValue={a.format} className="input"><option value="group">Խմբակային</option><option value="individual">Անհատական</option></select></label>
                <label className="label">Մեկնարկ (անհատականի համար. խմբի դեպքում՝ խմբի ամսաթիվը)<input name="startDate" type="date" defaultValue={iso(a.startDate)} className="input" /></label>
                <label className="label">Ամսական գումար (ամրագրված պայմանագրով, ֏)<input name="monthlyAmount" type="number" min={0} defaultValue={a.monthlyAmount ?? ""} className="input" /></label>
                <label className="label">Ամսական վճարումների քանակ<input name="months" type="number" min={1} max={24} defaultValue={a.months ?? a.course.months} className="input" /></label>
                <label className="label md:col-span-2">Անձնական դասի հղում (Zoom / Meet, անհատական ունկնդրի համար)<input name="meetingUrl" type="url" defaultValue={a.meetingUrl ?? ""} className="input" /></label>
                {b.plan === "monthly" && b.paidCount > 0 && (
                  <div className="flex flex-wrap gap-1.5 md:col-span-2">
                    {b.instalments.map((x) => <span key={x.index} className={`chip text-[12.5px] ${x.paid ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#f3f1ec] text-[#4b5563]"}`}>{x.index + 1}. {x.paid ? `✓ ${dateShort(x.paidAt)}` : dateShort(x.due) || "—"}</span>)}
                  </div>
                )}
                <label className="label">Անցած դասեր<input name="lessonsDone" type="number" min={0} defaultValue={a.lessonsDone} className="input" /></label>
                <label className="label">Պայմանագրի №<input name="contractNo" defaultValue={a.contractNo ?? ""} placeholder="ավտոմատ՝ կնքելիս" className="input" readOnly={!!a.contractSignedAt} /></label>
                <p className="m-0 self-end text-[14px]"><a href={`/hy/account/contract/${a.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold">Բացել պայմանագիրը →</a>{a.contractSnapshot ? <span className="text-muted"> · ստորագրություն՝ «{a.contractSnapshot.signedName}»{a.contractSnapshot.birthDate ? ` · ծնված՝ ${a.contractSnapshot.birthDate}` : ""}{a.contractSnapshot.guardian ? ` · ԱՆՉԱՓԱՀԱՍ, կնքել է ${a.contractSnapshot.guardian.relation === "parent" ? "ծնողը" : "օրինական ներկայացուցիչը"} (${a.contractSnapshot.guardian.phone}${a.contractSnapshot.guardian.email ? `, ${a.contractSnapshot.guardian.email}` : ""})` : ""}{a.contractSnapshot.ip ? ` · IP ${a.contractSnapshot.ip}` : ""}</span> : null}</p>
                <label className="label md:col-span-2">Ներքին նշում<textarea name="adminNote" defaultValue={a.adminNote ?? ""} rows={2} className="input py-2.5" /></label>
                <label className="label md:col-span-2">Լրացուցիչ տեքստ նամակում (ոչ պարտադիր)<textarea name="message" rows={2} placeholder="Օր.՝ մուտքային զրույցի ժամը, Zoom հղումը…" className="input py-2.5" /></label>
                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <Check name="notify" label="Կարգավիճակը փոխելիս ուղարկել նամակ ունկնդրին" defaultChecked />
                  <SubmitButton pendingText="Պահպանվում է…">Պահպանել</SubmitButton>
                </div>
                <p className="m-0 text-[12.5px] text-muted md:col-span-2">{tr(a.course.title, "hy")} · {a.group ? `${a.group.name}, ${dateShort(a.group.startDate)}` : "խումբ չկա"}</p>
              </ActionForm>
            </details>
          );
        })}
        {list.length === 0 && <p className="card p-6 text-muted">Հայտեր չկան։</p>}
      </div>
    </>
  );
}
