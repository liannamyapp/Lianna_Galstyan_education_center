import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { ATT_STATUSES, KINDS, journalApps, loadJournal, type AttStatus, type Kind } from "@/lib/journal";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Field, PageHead, th, td } from "@/components/admin/fields";
import { deleteAssessment, deleteSession, saveAssessment, saveAttendance, saveGrades, saveSession, saveThresholds } from "./actions";

export const dynamic = "force-dynamic";

const stHy: Record<AttStatus, string> = { P: "Ներկա", L: "Ուշացել է", R: "Տեսագրություն", A: "Բացակա" };
const stTone: Record<AttStatus, string> = {
  P: "has-[:checked]:bg-[#3f8a55] has-[:checked]:text-white has-[:checked]:border-[#3f8a55]",
  L: "has-[:checked]:bg-[#c9a24b] has-[:checked]:text-navy-950 has-[:checked]:border-[#c9a24b]",
  R: "has-[:checked]:bg-navy-800 has-[:checked]:text-white has-[:checked]:border-navy-800",
  A: "has-[:checked]:bg-[#8a2f1d] has-[:checked]:text-white has-[:checked]:border-[#8a2f1d]",
};
const kindHy: Record<Kind, string> = { homework: "Տնային աշխատանք", test: "Թեստ", project: "Նախագիծ", final: "Ավարտական նախագիծ" };
const ymd = (d: Date | null | undefined) => (d ? new Date(new Date(d).getTime() + 4 * 3_600_000).toISOString().slice(0, 10) : "");
const pctTxt = (v: number | null) => (v === null ? "—" : `${String(v).replace(/\.0$/, "")}%`);

export default async function Journal({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const sp = await searchParams;
  const courses = await db.select().from(s.courses).orderBy(asc(s.courses.order));
  const course = courses.find((x) => x.id === sp.c) ?? courses[0];
  if (!course) return <><PageHead title="Էլեկտրոնային մատյան" /><p className="text-muted">Նախ ստեղծեք դասընթաց։</p></>;

  const [groups, indiv, st] = await Promise.all([
    db.select().from(s.groups).where(eq(s.groups.courseId, course.id)).orderBy(desc(s.groups.startDate)),
    db.query.applications.findMany({ where: and(eq(s.applications.courseId, course.id), eq(s.applications.format, "individual"), inArray(s.applications.status, ["APPROVED", "PAID"])), with: { user: true } }),
    getSettings(),
  ]);
  const scopes = [
    ...groups.map((g) => ({ value: `g:${g.id}`, label: `Խումբ՝ ${g.name} (${dateShort(g.startDate)})` })),
    ...indiv.map((a) => ({ value: `a:${a.id}`, label: `Անհատական՝ ${a.user.name}` })),
  ];
  const scope = scopes.find((x) => x.value === sp.s)?.value ?? scopes[0]?.value ?? "";
  const gId = scope.startsWith("g:") ? scope.slice(2) : null;
  const aId = scope.startsWith("a:") ? scope.slice(2) : null;

  const apps = scope
    ? (await journalApps(gId ? and(eq(s.applications.courseId, course.id), eq(s.applications.groupId, gId)) : eq(s.applications.id, aId!)))
        .sort((x, y) => x.user.name.localeCompare(y.user.name, "hy"))
    : [];
  const data = await loadJournal(apps);
  const where = gId ? eq(s.journalSessions.groupId, gId) : aId ? eq(s.journalSessions.applicationId, aId) : undefined;
  const [sessions, works] = where ? await Promise.all([
    db.select().from(s.journalSessions).where(where).orderBy(desc(s.journalSessions.date)),
    db.select().from(s.assessments).where(gId ? eq(s.assessments.groupId, gId) : eq(s.assessments.applicationId, aId!)).orderBy(desc(s.assessments.date), desc(s.assessments.createdAt)),
  ]) : [[], []];
  const appIds = apps.map((a) => a.id);
  const [marks, scores] = appIds.length ? await Promise.all([
    sessions.length ? db.select().from(s.attendance).where(and(inArray(s.attendance.sessionId, sessions.map((x) => x.id)), inArray(s.attendance.applicationId, appIds))) : [],
    works.length ? db.select().from(s.grades).where(and(inArray(s.grades.assessmentId, works.map((x) => x.id)), inArray(s.grades.applicationId, appIds))) : [],
  ]) : [[], []];

  const thr = st.journal;
  const eligibleCount = apps.filter((a) => data.get(a.id)?.eligible).length;

  return (
    <>
      <PageHead title="Էլեկտրոնային մատյան" />

      <AdminCard>
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Դասընթաց"><select name="c" defaultValue={course.id} className="input">{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title.hy}</option>)}</select></Field>
          <Field label="Խումբ կամ անհատական ունկնդիր">
            <select name="s" defaultValue={scope} className="input">{scopes.length ? scopes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : <option value="">Խմբեր կամ անհատական ունկնդիրներ չկան</option>}</select>
          </Field>
          <button className="btn-navy min-h-12">Բացել</button>
        </form>
        <details className="mt-4">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-navy-800">Վկայականի շեմերը՝ հաճախում {thr.attendanceMin}%, միջին գնահատական {thr.resultMin}%</summary>
          <ActionForm action={saveThresholds} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="label w-[170px]">Նվազագույն հաճախում, %<input name="attendanceMin" type="number" min={0} max={100} defaultValue={thr.attendanceMin} className="input" /></label>
            <label className="label w-[200px]">Նվազագույն միջին գնահատական, %<input name="resultMin" type="number" min={0} max={100} defaultValue={thr.resultMin} className="input" /></label>
            <SubmitButton className="btn-soft min-h-12" pendingText="…">Պահպանել</SubmitButton>
            <p className="m-0 basis-full text-[12.5px] text-muted">Պայմանագրի 7.1 կետով՝ վկայականը տրվում է առնվազն 80% հաճախման, ավարտական նախագծի հանձնման և ամբողջական վճարման դեպքում։ Միջին գնահատականի շեմը որոշում եք դուք։</p>
          </ActionForm>
        </details>
      </AdminCard>

      {!scope ? null : (
        <>
          <AdminCard title={`Ամփոփում · ${apps.length} ունկնդիր · վկայականի պահանջները բավարարում է՝ ${eligibleCount}`}>
            {apps.length === 0 ? <p className="m-0 text-muted">Այս խմբում հաստատված կամ վճարած ունկնդիրներ դեռ չկան։</p> : (
              <table className="rtable w-full border-collapse">
                <thead><tr><th className={th}>Ունկնդիր</th><th className={th}>Հաճախում</th><th className={th}>Միջին գնահատական</th><th className={th}>Ավարտական</th><th className={th}>Վճարում</th><th className={th}>Պահանջների կատարում</th></tr></thead>
                <tbody>{apps.map((a) => {
                  const j = data.get(a.id)!;
                  const tone = (okv: boolean, has: boolean) => (!has ? "text-muted" : okv ? "text-[#1f5f33] font-semibold" : "text-[#8a5a2b] font-semibold");
                  return (
                    <tr key={a.id}>
                      <td data-label="Ունկնդիր" className={td}><Link href={`/admin/students/${a.userId}`} className="font-semibold">{a.user.name}</Link></td>
                      <td data-label="Հաճախում" className={td}><span><span className={tone(j.checks.attendance, j.attendancePct !== null)}>{pctTxt(j.attendancePct)}</span> <span className="text-[12.5px] text-muted">({j.attended}/{j.marked})</span></span></td>
                      <td data-label="Միջին գնահատական" className={td}><span><span className={tone(j.checks.result, j.resultPct !== null)}>{pctTxt(j.resultPct)}</span> <span className="text-[12.5px] text-muted">({j.graded}/{j.assessments.length})</span></span></td>
                      <td data-label="Ավարտական" className={td}>{j.finalDone ? <span className="text-[#1f5f33]">✓ հանձնված</span> : <span className="text-muted">—</span>}</td>
                      <td data-label="Վճարում" className={td}>{j.paid ? <span className="text-[#1f5f33]">✓ վճարված</span> : <span className="text-[#8a5a2b]">մասնակի</span>}</td>
                      <td data-label="Պահանջների կատարում" className={td}>
                        <div className="flex w-full max-w-[260px] flex-col items-stretch gap-1.5 text-left lg:max-w-none">
                        <div className="flex min-w-[140px] items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#efe9dc]"><div className={`h-full rounded-full ${j.eligible ? "bg-[#3f8a55]" : "bg-gold-500"}`} style={{ width: `${j.readiness}%` }} /></div>
                          <b className="w-10 text-right text-[13.5px]">{j.readiness}%</b>
                        </div>
                        <span className={`chip w-fit text-[12px] font-semibold ${j.eligible ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#f1ede4] text-muted"}`}>{j.eligible ? "Բավարարում է վկայականի պահանջները" : "Դեռ չի բավարարում"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
            <p className="mt-3 mb-0 text-[12.5px] text-muted">«Պահանջների կատարում»՝ չորս պահանջների միջինը (հաճախում, միջին գնահատական, ավարտական նախագիծ, վճարում)։ Հաճախման մեջ հաշվվում են ներկա, ուշացած և տեսագրությունը դիտած դասերը։</p>
          </AdminCard>

          <AdminCard title={`Դասեր և հաճախումներ · ${sessions.length} / ${course.weeks * course.lessonsPerWeek} պլանավորված`}>
            <ActionForm action={saveSession} resetOnSuccess className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="scope" value={scope} />
              <label className="label w-full sm:w-[170px]">Ամսաթիվ<input name="date" type="date" required defaultValue={ymd(new Date())} className="input" /></label>
              <label className="label min-w-0 flex-1 basis-[220px]">Դասի թեմա<input name="topic" maxLength={300} placeholder="Օր.՝ Flexbox և Grid" className="input" /></label>
              <SubmitButton className="btn-navy min-h-12" pendingText="…">Ավելացնել դաս</SubmitButton>
            </ActionForm>

            <div className="mt-4 flex flex-col gap-2">
              {sessions.map((x) => {
                const ms = marks.filter((m) => m.sessionId === x.id);
                const att = ms.filter((m) => m.status !== "A").length;
                return (
                  <details key={x.id} className="rounded-xl border border-[#eee7d8] bg-white">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px]">
                      <b className="text-navy-900">{dateShort(x.date)}</b>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{x.topic || "—"}</span>
                      <span className={`chip text-[12.5px] ${ms.length ? "" : "bg-[#fdf3dc] text-[#7a5410]"}`}>{ms.length ? `ներկա՝ ${att} / ${ms.length}` : "հաճախումները նշված չեն"}</span>
                    </summary>
                    <div className="border-t border-[#eee7d8] px-4 py-4">
                      {apps.length === 0 ? <p className="m-0 text-muted">Ունկնդիրներ չկան։</p> : (
                        <ActionForm action={saveAttendance} className="flex flex-col gap-2.5">
                          <input type="hidden" name="sessionId" value={x.id} />
                          {apps.map((a) => {
                            const m = ms.find((r) => r.applicationId === a.id);
                            const cur = (m?.status as AttStatus | undefined) ?? (ms.length ? "" : "P");
                            return (
                              <div key={a.id} className="flex flex-wrap items-center gap-2 border-b border-[#f3eee3] pb-2.5 last:border-0">
                                <input type="hidden" name="app" value={a.id} />
                                <span className="min-w-0 basis-full text-[14px] font-semibold text-navy-900 sm:basis-[180px]">{a.user.name}</span>
                                <div role="radiogroup" aria-label={a.user.name} className="flex flex-wrap gap-1.5">
                                  {ATT_STATUSES.map((v) => (
                                    <label key={v} className={`cursor-pointer rounded-full border border-[#d9d0bd] px-3 py-1.5 text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-500 ${stTone[v]}`}>
                                      <input type="radio" name={`st_${a.id}`} value={v} defaultChecked={cur === v} className="sr-only" />{stHy[v]}
                                    </label>
                                  ))}
                                </div>
                                <input name={`note_${a.id}`} defaultValue={m?.note ?? ""} maxLength={300} placeholder="Նշում" aria-label={`Նշում՝ ${a.user.name}`} className="input h-10 min-w-0 flex-1 basis-[160px] text-[13.5px]" />
                              </div>
                            );
                          })}
                          <div><SubmitButton className="btn-navy min-h-11" pendingText="…">Պահպանել հաճախումները</SubmitButton></div>
                        </ActionForm>
                      )}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-[13px] text-muted">Փոխել ամսաթիվը կամ թեման, ջնջել դասը</summary>
                        <ActionForm action={saveSession} className="mt-2 flex flex-wrap items-end gap-3">
                          <input type="hidden" name="id" value={x.id} /><input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="scope" value={scope} />
                          <label className="label w-full sm:w-[170px]">Ամսաթիվ<input name="date" type="date" required defaultValue={ymd(x.date)} className="input" /></label>
                          <label className="label min-w-0 flex-1 basis-[220px]">Թեմա<input name="topic" defaultValue={x.topic} maxLength={300} className="input" /></label>
                          <SubmitButton className="btn-soft min-h-12" pendingText="…">Պահպանել</SubmitButton>
                        </ActionForm>
                        <form action={deleteSession} className="mt-2"><input type="hidden" name="id" value={x.id} /><button className="text-[13px] font-semibold text-[#8a2f1d] underline">Ջնջել այս դասը և դրա հաճախումները</button></form>
                      </details>
                    </div>
                  </details>
                );
              })}
              {sessions.length === 0 && <p className="m-0 text-[14px] text-muted">Դասեր դեռ չկան։ Ավելացրեք դասը, ապա բացեք այն և նշեք, թե ով է ներկա եղել։</p>}
            </div>
          </AdminCard>

          <AdminCard title={`Գնահատումներ · ${works.length} աշխատանք`}>
            <ActionForm action={saveAssessment} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_.7fr_.7fr_1fr_auto]">
              <input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="scope" value={scope} />
              <label className="label">Աշխատանքի անվանում<input name="title" required maxLength={200} placeholder="Օր.՝ Landing էջ" className="input" /></label>
              <label className="label">Տեսակ<select name="kind" defaultValue="homework" className="input">{KINDS.map((k) => <option key={k} value={k}>{kindHy[k]}</option>)}</select></label>
              <label className="label">Առավելագույն միավոր<input name="maxScore" type="number" min={1} max={1000} defaultValue={10} className="input" /></label>
              <label className="label">Կշիռ<input name="weight" type="number" min={0} max={100} defaultValue={1} className="input" /></label>
              <label className="label">Ամսաթիվ<input name="date" type="date" defaultValue={ymd(new Date())} className="input" /></label>
              <SubmitButton className="btn-navy min-h-12" pendingText="…">Ավելացնել</SubmitButton>
            </ActionForm>
            <p className="mt-2 mb-0 text-[12.5px] text-muted">Կշիռը ցույց է տալիս աշխատանքի կարևորությունը միջին գնահատականում. օրինակ՝ տնային աշխատանքը՝ 1, ավարտական նախագիծը՝ 4։ «Ավարտական նախագիծ» տեսակի աշխատանքը գնահատելուց հետո պահանջը համարվում է կատարված։</p>

            <div className="mt-4 flex flex-col gap-2">
              {works.map((w) => {
                const gs = scores.filter((g) => g.assessmentId === w.id);
                const avg = gs.length ? Math.round((gs.reduce((n, g) => n + g.score / w.maxScore, 0) / gs.length) * 1000) / 10 : null;
                return (
                  <details key={w.id} className="rounded-xl border border-[#eee7d8] bg-white">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px]">
                      <b className="min-w-0 flex-1 [overflow-wrap:anywhere] text-navy-900">{w.title}</b>
                      <span className="text-[12.5px] text-muted">{kindHy[w.kind as Kind] ?? w.kind} · max {w.maxScore} · կշիռ {w.weight}{w.date ? ` · ${dateShort(w.date)}` : ""}</span>
                      <span className={`chip text-[12.5px] ${gs.length ? "" : "bg-[#fdf3dc] text-[#7a5410]"}`}>{gs.length ? `գնահատված՝ ${gs.length} / ${apps.length} · միջին ${pctTxt(avg)}` : "գնահատված չէ"}</span>
                    </summary>
                    <div className="border-t border-[#eee7d8] px-4 py-4">
                      {apps.length === 0 ? <p className="m-0 text-muted">Ունկնդիրներ չկան։</p> : (
                        <ActionForm action={saveGrades} className="flex flex-col gap-2.5">
                          <input type="hidden" name="assessmentId" value={w.id} />
                          {apps.map((a) => {
                            const g = gs.find((r) => r.applicationId === a.id);
                            return (
                              <div key={a.id} className="flex flex-wrap items-center gap-2 border-b border-[#f3eee3] pb-2.5 last:border-0">
                                <input type="hidden" name="app" value={a.id} />
                                <span className="min-w-0 basis-full text-[14px] font-semibold text-navy-900 sm:basis-[180px]">{a.user.name}</span>
                                <span className="flex items-center gap-1.5">
                                  <input name={`sc_${a.id}`} type="number" inputMode="decimal" step="0.5" min={0} max={w.maxScore} defaultValue={g?.score ?? ""} aria-label={`Միավոր՝ ${a.user.name}`} className="input h-10 w-[88px] text-[15px]" />
                                  <span className="text-[13px] text-muted">/ {w.maxScore}</span>
                                </span>
                                <input name={`cm_${a.id}`} defaultValue={g?.comment ?? ""} maxLength={500} placeholder="Մեկնաբանություն ունկնդրի համար" aria-label={`Մեկնաբանություն՝ ${a.user.name}`} className="input h-10 min-w-0 flex-1 basis-[180px] text-[13.5px]" />
                              </div>
                            );
                          })}
                          <p className="m-0 text-[12.5px] text-muted">Դատարկ դաշտ = դեռ գնահատված չէ (միջինում չի հաշվվում)։ Չհանձնած աշխատանքի համար նշեք 0։</p>
                          <div><SubmitButton className="btn-navy min-h-11" pendingText="…">Պահպանել գնահատականները</SubmitButton></div>
                        </ActionForm>
                      )}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-[13px] text-muted">Խմբագրել կամ ջնջել աշխատանքը</summary>
                        <ActionForm action={saveAssessment} className="mt-2 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_.7fr_.7fr_1fr_auto]">
                          <input type="hidden" name="id" value={w.id} />
                          <label className="label">Անվանում<input name="title" required defaultValue={w.title} maxLength={200} className="input" /></label>
                          <label className="label">Տեսակ<select name="kind" defaultValue={w.kind} className="input">{KINDS.map((k) => <option key={k} value={k}>{kindHy[k]}</option>)}</select></label>
                          <label className="label">Max<input name="maxScore" type="number" min={1} max={1000} defaultValue={w.maxScore} className="input" /></label>
                          <label className="label">Կշիռ<input name="weight" type="number" min={0} max={100} defaultValue={w.weight} className="input" /></label>
                          <label className="label">Ամսաթիվ<input name="date" type="date" defaultValue={ymd(w.date)} className="input" /></label>
                          <SubmitButton className="btn-soft min-h-12" pendingText="…">Պահպանել</SubmitButton>
                        </ActionForm>
                        <form action={deleteAssessment} className="mt-2"><input type="hidden" name="id" value={w.id} /><button className="text-[13px] font-semibold text-[#8a2f1d] underline">Ջնջել աշխատանքը և դրա գնահատականները</button></form>
                      </details>
                    </div>
                  </details>
                );
              })}
              {works.length === 0 && <p className="m-0 text-[14px] text-muted">Աշխատանքներ դեռ չկան։ Ավելացրեք աշխատանքը, ապա բացեք այն և նշեք գնահատականները։</p>}
            </div>
          </AdminCard>
        </>
      )}
    </>
  );
}
