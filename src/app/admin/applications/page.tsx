import Link from "next/link";
import { desc, eq, asc, inArray } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort, money } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHead, badge, statusHy, Check } from "@/components/admin/fields";
import { quickApplication, updateApplication } from "../actions";
import { ValueButton } from "@/components/ValueButton";
import { FLOW_STEPS, NEEDS_ADMIN, flowStage, flowWarnings } from "@/lib/admin-flow";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";

const STATUSES = ["NEW", "INTERVIEW", "APPROVED", "PAID", "REJECTED", "CANCELLED"] as const;

export default async function Applications({ searchParams }: { searchParams: Promise<{ status?: string; open?: string }> }) {
  const { status, open } = await searchParams;
  const st = STATUSES.find((x) => x === status);
  const todo = status === "todo";
  const all = await db.query.applications.findMany({
    where: st ? eq(s.applications.status, st) : undefined, orderBy: [desc(s.applications.createdAt)], limit: 200,
    with: { user: true, course: true, group: true, payments: true },
  });
  const certs = all.length ? await db.select({ userId: s.certificates.userId, courseId: s.certificates.courseId, revoked: s.certificates.revoked, receivedAt: s.certificates.receivedAt }).from(s.certificates).where(inArray(s.certificates.userId, [...new Set(all.map((a) => a.userId))])) : [];
  const certOf = (a: (typeof all)[number]) => certs.find((c) => c.userId === a.userId && c.courseId === a.courseId && !c.revoked);
  const list = todo ? all.filter((a) => NEEDS_ADMIN.includes(flowStage(a, certOf(a)).key)) : all;
  const groups = await db.select().from(s.groups).orderBy(asc(s.groups.startDate));
  const cfg = (await getSettings()).payments;
  const stateHy = { unpaid: "Չվճարված", upcoming: "Ժամանակին", soon: "Մոտենում է", due: "Վճարման օր", overdue: "Ուշացում · մուտքը դադարեցված", done: "Ամբողջությամբ վճարված" } as const;
  const stateCls = { unpaid: "bg-[#eef0f3] text-[#4b5563]", upcoming: "bg-[#e3f1e6] text-[#1f5f33]", soon: "bg-[#fbf2dd] text-[#7a5a12]", due: "bg-[#fbefeb] text-[#8a2f1d]", overdue: "bg-[#8a2f1d] text-white", done: "bg-[#e3f1e6] text-[#1f5f33]" } as const;
  const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return (
    <>
      <PageHead title="Հայտեր" />
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Ֆիլտր">
        <Link href="/admin/applications?status=todo" className={`chip min-h-10 px-4 font-semibold no-underline ${todo ? "bg-gold-500 text-navy-950" : "bg-[#fbf2dd] text-[#7a5a12]"}`}>Իմ անելիքը</Link>
        <Link href="/admin/applications" className={`chip min-h-10 px-4 no-underline ${!st && !todo ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>Բոլորը</Link>
        {STATUSES.map((x) => <Link key={x} href={`/admin/applications?status=${x}`} className={`chip min-h-10 px-4 no-underline ${st === x ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>{statusHy[x]}</Link>)}
      </nav>
      <div className="flex flex-col gap-3">
        {list.map((a) => {
          const paid = a.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amount, 0);
          const b = billing(a, a.course, a.group?.startDate, a.payments, cfg);
          const g = flowStage(a, certOf(a));
          const warns = flowWarnings(a);
          const mine = NEEDS_ADMIN.includes(g.key);
          const courseGroups = groups.filter((x) => x.courseId === a.courseId && x.status !== "FINISHED");
          const groupPick = a.format === "group" && courseGroups.length > 0 && (
            <select name="groupId" defaultValue={a.groupId ?? (courseGroups.length === 1 ? courseGroups[0].id : "")} className="input min-h-11 max-w-full sm:w-auto" aria-label="Խումբ">
              <option value="">— խումբ (կարող եք նշել հետո) —</option>
              {courseGroups.map((x) => <option key={x.id} value={x.id}>{x.name} · {dateShort(x.startDate)}</option>)}
            </select>
          );
          return (
            <details key={a.id} id={`app-${a.id}`} open={open === a.id} className={`card group scroll-mt-24 ${mine ? "border-gold-500/70" : ""}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 p-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-[200px] flex-1"><b className="text-navy-900">{a.user.name}</b><br /><span className="text-[13px] text-muted">{a.user.email} · {a.user.phone ?? "—"}</span></span>
                <span className="font-mono text-[13px]">{a.course.code}</span>
                <span className={`chip font-semibold ${a.format === "individual" ? "bg-[#fbf2dd] text-[#7a5a12]" : "bg-[#e6eef8] text-navy-800"}`}>{a.format === "individual" ? "Անհատական" : "Խմբակային"}</span>
                <span className="text-[13px] text-muted">{a.plan === "full" ? "Ամբողջ" : `Ամսական · ${b.paidCount}/${b.months}`} · վճարված {money(paid)}</span>
                {a.status === "PAID" && <span className={`chip font-semibold ${stateCls[b.state]}`}>{stateHy[b.state]}{b.next?.due && b.state !== "done" ? ` · ${dateShort(b.next.due)}` : ""}</span>}
                <span className="text-[13px] text-muted">{dateShort(a.createdAt)}</span>
                <span className={`chip font-semibold ${a.contractSignedAt ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#fdf3e1] text-[#8a5a2b]"}`}>{a.contractSignedAt ? `Պայմանագիրը կնքված է ${dateShort(a.contractSignedAt)}` : "Պայմանագիրը չի կնքվել"}</span>
                <span className={`chip font-semibold ${badge[a.status]}`}>{statusHy[a.status]}</span>
                <span className={`basis-full text-[13.5px] ${mine ? "font-semibold text-[#7a5a12]" : "text-muted"}`}>{mine ? "● Ձեր քայլն է․ " : "→ "}{g.text}{warns.length ? ` · ⚠ ${warns.length}` : ""}</span>
              </summary>
              <div className="border-t border-[#eee7d8] p-5">
                {g.done >= 0 && (
                  <ol className="m-0 mb-4 grid list-none grid-cols-7 gap-1 p-0" aria-label="Ընթացք">
                    {FLOW_STEPS.map((label, i) => {
                      const done = i < g.done, now = i === g.done;
                      return (
                        <li key={label} className="flex min-w-0 flex-col items-center gap-1 text-center" title={label}>
                          <span className={`flex size-7 items-center justify-center rounded-full text-[12px] font-bold ${done ? "bg-[#1f5f33] text-white" : now ? "bg-gold-500 text-navy-950 ring-4 ring-gold-500/25" : "bg-[#eef0f3] text-[#7b8798]"}`}>{done ? "✓" : i + 1}</span>
                          <span className={`hidden text-[11.5px] leading-tight sm:block ${now ? "font-semibold text-navy-900" : done ? "text-[#1f5f33]" : "text-muted"}`}>{label}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {warns.length > 0 && (
                  <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">{warns.map((w) => <li key={w} className="rounded-lg bg-[#fdf1e3] px-3 py-2 text-[13.5px] text-[#7a4a12]">⚠ {w}</li>)}</ul>
                )}
                <div className={`rounded-xl p-4 ${mine ? "bg-[#fbf7ec]" : "bg-ivory"}`}>
                  <p className="m-0 mb-3 text-[14.5px]"><b>Հաջորդ քայլը՝</b> {g.text}</p>
                  {(g.key === "NEW" || g.key === "INTERVIEW") && (
                    <ActionForm action={quickApplication} className="flex flex-col gap-2.5">
                      <input type="hidden" name="id" value={a.id} />
                      <textarea name="message" rows={2} placeholder="Հաղորդագրություն ունկնդրին (ոչ պարտադիր)՝ օր. զրույցի օրը, ժամը, հղումը" className="input py-2.5 text-[14px]" />
                      <div className="flex flex-wrap items-center gap-2">
                        {g.key === "NEW" && <ValueButton name="op" value="interview" className="btn-navy min-h-11">Հրավիրել հարցազրույցի</ValueButton>}
                        {groupPick}
                        <ValueButton name="op" value="approve" className={g.key === "NEW" ? "btn-soft min-h-11" : "btn-navy min-h-11"}>{g.key === "NEW" ? "Հաստատել առանց զրույցի" : "Հաստատել"}</ValueButton>
                      </div>
                    </ActionForm>
                  )}
                  {(g.key === "SIGN" || g.key === "PAY") && (
                    <div className="flex flex-wrap gap-2">
                      {g.key === "PAY" && <Link href={`/admin/payments?app=${a.id}`} className="btn-navy min-h-11">Գրանցել կանխիկ / փոխանցում</Link>}
                      <ActionForm action={quickApplication} className="flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        <ValueButton name="op" value="remind" className="btn-soft min-h-11">Հիշեցնել ունկնդրին</ValueButton>
                      </ActionForm>
                      <a href={`/hy/account/contract/${a.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-11">Պայմանագիրը</a>
                    </div>
                  )}
                  {g.key === "SETUP" && <a href={`#edit-${a.id}`} className="btn-navy min-h-11">Լրացնել ներքևում ↓</a>}
                  {g.key === "STUDY" && <div className="flex flex-wrap gap-2"><Link href="/admin/journal" className="btn-soft min-h-11">Էլ. մատյան</Link><Link href="/admin/lessons" className="btn-soft min-h-11">Տեսադասեր</Link></div>}
                  {(g.key === "CERT" || g.key === "STUDY") && <Link href={`/admin/certificates?app=${a.id}`} className={`${g.key === "CERT" ? "btn-navy" : "btn-ghost"} mt-2 min-h-11`}>Տալ վկայական</Link>}
                </div>
                {(g.key === "NEW" || g.key === "INTERVIEW" || g.key === "SIGN" || g.key === "PAY") && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13.5px] text-[#8a2f1d]">Մերժել հայտը…</summary>
                    <ActionForm action={quickApplication} className="mt-2 flex flex-col gap-2 rounded-xl border border-[#f0cfc6] p-3">
                      <input type="hidden" name="id" value={a.id} />
                      <textarea name="message" rows={2} placeholder="Պատճառը կամ բացատրություն ունկնդրին (ոչ պարտադիր)" className="input py-2.5 text-[14px]" />
                      <Check name="confirm" label="Հաստատում եմ՝ մերժել այս հայտը (ունկնդիրը կստանա ծանուցում)" />
                      <ValueButton name="op" value="reject" className="btn-soft min-h-11 self-start text-[#8a2f1d]">Մերժել</ValueButton>
                    </ActionForm>
                  </details>
                )}
              </div>
              <details id={`edit-${a.id}`} open={g.key === "SETUP" || undefined} className="border-t border-[#eee7d8]">
                <summary className="cursor-pointer px-5 py-3.5 text-[14px] font-semibold text-navy-800">Մանրամասն խմբագրել (կարգավիճակ, խումբ, մեկնարկ, հղում, գումար)</summary>
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
                <label className="label md:col-span-2">Հաղորդագրություն ունկնդրին (ոչ պարտադիր)<textarea name="message" rows={2} placeholder="Օր.՝ մուտքային զրույցի ժամը, Zoom հղումը…" className="input py-2.5" /></label>
                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <Check name="notify" label="Ծանուցել ունկնդրին (անձնական էջում և էլ. փոստով)՝ կարգավիճակի, խմբի, մեկնարկի, հղման փոփոխության կամ հաղորդագրության մասին" defaultChecked />
                  <SubmitButton pendingText="Պահպանվում է…">Պահպանել</SubmitButton>
                </div>
                <p className="m-0 text-[12.5px] text-muted md:col-span-2">{tr(a.course.title, "hy")} · {a.group ? `${a.group.name}, ${dateShort(a.group.startDate)}` : "խումբ չկա"}</p>
              </ActionForm>
              </details>
            </details>
          );
        })}
        {list.length === 0 && <p className="card p-6 text-muted">{todo ? "Անելիք չկա․ բոլոր հայտերը կամ ընթացքի մեջ են, կամ սպասում են ունկնդրի քայլին։" : "Հայտեր չկան։"}</p>}
      </div>
    </>
  );
}
