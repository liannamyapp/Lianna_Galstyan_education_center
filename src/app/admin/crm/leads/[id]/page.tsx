import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort, money } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, PageHead, badge, statusHy } from "@/components/admin/fields";
import { ScoreBadge, StageBadge, isoLocal, relTime, sourceLabel } from "@/components/admin/crm";
import { CHANNELS, PLACEHOLDERS, SOURCES, STAGES, activityHy, channelHy, sourceHy, stageHy } from "@/lib/crm/constants";
import { nextBestAction, scoreLead } from "@/lib/crm/score";
import { prettyPhone } from "@/lib/crm/leads";
import { channelStatus, reachable } from "@/lib/crm/channels";
import { addNote, deleteLead, moveLead, saveTask, sendMessage, toggleTask, updateLead } from "../../actions";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.query.leads.findFirst({ where: eq(s.leads.id, id), with: { course: true, user: true } });
  if (!lead) notFound();

  const [activities, tasks, courses, templates, [{ inbound }], apps] = await Promise.all([
    db.select().from(s.leadActivities).where(eq(s.leadActivities.leadId, id)).orderBy(desc(s.leadActivities.createdAt)).limit(200),
    db.select().from(s.crmTasks).where(eq(s.crmTasks.leadId, id)).orderBy(asc(s.crmTasks.done), asc(s.crmTasks.dueAt)),
    db.select({ id: s.courses.id, code: s.courses.code, title: s.courses.title }).from(s.courses).orderBy(asc(s.courses.order)),
    db.select({ key: s.crmTemplates.key, name: s.crmTemplates.name }).from(s.crmTemplates).orderBy(asc(s.crmTemplates.createdAt)),
    db.select({ inbound: sql<number>`count(*)::int` }).from(s.leadActivities).where(and(eq(s.leadActivities.leadId, id), eq(s.leadActivities.type, "message_in"))),
    lead.userId ? db.query.applications.findMany({ where: eq(s.applications.userId, lead.userId), with: { course: true, payments: true } }) : Promise.resolve([]),
  ]);
  const { parts } = scoreLead({ ...lead, inboundCount: inbound, hasUser: Boolean(lead.userId) });
  const can = reachable(lead);
  const on = channelStatus();
  const wa = lead.phone ? `https://wa.me/${lead.phone}` : null;

  return (
    <>
      <PageHead title={lead.name}>
        <StageBadge stage={lead.stage} />
        <ScoreBadge score={lead.score} />
        <Link href="/admin/crm/leads" className="btn-soft min-h-11">← Լիդեր</Link>
      </PageHead>

      <div className="mb-5 flex flex-wrap gap-2">
        {lead.phone && <a href={`tel:+${lead.phone}`} className="btn-navy min-h-11">📞 Զանգել {prettyPhone(lead.phone)}</a>}
        {wa && <a href={wa} target="_blank" rel="noopener" className="btn-soft min-h-11">WhatsApp</a>}
        {lead.telegramUsername && <a href={`https://t.me/${lead.telegramUsername}`} target="_blank" rel="noopener" className="btn-soft min-h-11">Telegram</a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="btn-soft min-h-11">✉ {lead.email}</a>}
        {lead.userId && <Link href={`/admin/students?q=${encodeURIComponent(lead.email ?? lead.name)}`} className="btn-soft min-h-11">Կայքի հաշիվը</Link>}
      </div>

      <form action={moveLead} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="id" value={lead.id} />
        <label className="label min-w-0 flex-1 basis-[200px]">Տեղափոխել փուլ<select name="stage" defaultValue={lead.stage} className="input">{STAGES.map((x) => <option key={x} value={x}>{stageHy[x]}</option>)}</select></label>
        <label className="label min-w-0 flex-[2] basis-[200px]">Պատճառ / մեկնաբանություն (կորցրածի դեպքում՝ ինչու)<input name="reason" className="input" placeholder="օր.՝ գինը, ժամանակը, ընտրեց այլ կենտրոն" /></label>
        <button className="btn-navy min-h-12">Տեղափոխել</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <AdminCard title="Հաղորդագրություն ուղարկել">
            <ActionForm action={sendMessage} className="grid gap-3" resetOnSuccess>
              <input type="hidden" name="id" value={lead.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="label">Ալիք<select name="channel" defaultValue="auto" className="input">
                  <option value="auto">Ավտոմատ (լավագույնը)</option>
                  {CHANNELS.map((c) => <option key={c} value={c} disabled={!can.includes(c)}>{channelHy[c]}{!on[c] ? " — միացված չէ" : !can.includes(c) ? " — կապ չկա" : ""}</option>)}
                </select></label>
                <label className="label">Ձևանմուշ<select name="template" className="input"><option value="">— ազատ տեքստ —</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></label>
              </div>
              <label className="label">Թեմա (էլ. նամակի համար)<input name="subject" className="input" /></label>
              <label className="label">Տեքստ (դատարկ թողնելու դեպքում կուղարկվի ձևանմուշը)<textarea name="text" rows={4} className="input py-2.5" placeholder={`Կարող եք օգտագործել՝ ${PLACEHOLDERS.join(" ")}`} /></label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12.5px] text-muted">Հասանելի՝ {can.length ? can.map((c) => channelHy[c]).join(", ") : "ոչ մի ալիք (ավելացրեք հեռախոս կամ միացրեք ալիքները)"}</span>
                <SubmitButton pendingText="Ուղարկվում է…">Ուղարկել</SubmitButton>
              </div>
            </ActionForm>
          </AdminCard>

          <AdminCard title="Զանգ կամ նշում">
            <ActionForm action={addNote} className="grid gap-3" resetOnSuccess>
              <input type="hidden" name="id" value={lead.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="label">Տեսակ<select name="type" className="input"><option value="call">Զանգ</option><option value="note">Նշում</option></select></label>
                <label className="label">Զանգի արդյունք<select name="result" className="input"><option value="talked">Խոսեցինք</option><option value="no_answer">Չպատասխանեց</option><option value="callback">Խնդրեց հետո զանգել</option></select></label>
              </div>
              <label className="label">Ինչ պարզեցիք<textarea name="body" rows={3} required className="input py-2.5" placeholder="Նպատակը, փորձը, հարմար ժամերը, առարկությունները…" /></label>
              <div><SubmitButton pendingText="Պահպանվում է…">Ավելացնել պատմությանը</SubmitButton></div>
            </ActionForm>
          </AdminCard>

          <AdminCard title={`Պատմություն · ${activities.length}`}>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {activities.map((a) => {
                const out = a.type === "message_out", inn = a.type === "message_in";
                const meta = a.meta as { from?: string; to?: string; ok?: boolean; result?: string };
                return (
                  <li key={a.id} className={`rounded-xl border p-3 text-[14px] ${inn ? "border-[#cfe0f3] bg-[#f3f8fd]" : out ? "border-[#d9ead9] bg-[#f4faf4]" : "border-line bg-white"}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                      <b className="text-[#3d4757]">{activityHy[a.type] ?? a.type}</b>
                      {a.channel && <span>· {channelHy[a.channel] ?? a.channel}</span>}
                      {out && meta.ok === false && <span className="font-semibold text-[#8a2f1d]">· չհաջողվեց</span>}
                      {a.type === "stage" && meta.from && meta.to && <span>· {stageHy[meta.from as keyof typeof stageHy]} → {stageHy[meta.to as keyof typeof stageHy]}</span>}
                      <span className="ml-auto">{dateShort(a.createdAt)} · {relTime(a.createdAt)}</span>
                    </div>
                    {a.body && <p className="m-0 whitespace-pre-wrap">{a.body}</p>}
                  </li>
                );
              })}
            </ol>
          </AdminCard>
        </div>

        <div className="flex flex-col gap-6">
          <AdminCard title="Հաջորդ քայլը">
            <p className="m-0 mb-3 rounded-xl bg-ivory p-3 text-[14px]"><b>Խորհուրդ՝</b> {nextBestAction(lead)}</p>
            <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-[14px]">
                  <form action={toggleTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.done ? "0" : "1"} /><button aria-label={t.done ? "Վերաբացել" : "Կատարված"} className={`flex size-7 items-center justify-center rounded-full border-2 ${t.done ? "border-[#2f7a46] bg-[#2f7a46] text-white" : "border-navy-800 text-navy-800"}`}>✓</button></form>
                  <span className={`flex-1 ${t.done ? "text-muted line-through" : ""}`}>{t.title}</span>
                  <span className={`text-[12.5px] ${!t.done && t.dueAt.getTime() < Date.now() ? "font-semibold text-[#8a2f1d]" : "text-muted"}`}>{relTime(t.dueAt)}</span>
                </li>
              ))}
            </ul>
            <ActionForm action={saveTask} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" resetOnSuccess>
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="label">Նոր առաջադրանք<input name="title" required className="input" placeholder="օր.՝ ուղարկել ծրագիրը" /></label>
              <label className="label">Երբ<input name="dueAt" type="datetime-local" className="input" /></label>
              <SubmitButton className="btn-navy min-h-12">+</SubmitButton>
            </ActionForm>
          </AdminCard>

          <AdminCard title="Գնահատական" actions={<ScoreBadge score={lead.score} />}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
              {parts.map((p) => <li key={p.label} className="flex justify-between gap-3"><span className="text-[#3d4757]">{p.label}</span><b className={p.points < 0 ? "text-[#8a2f1d]" : "text-navy-900"}>{p.points > 0 ? `+${p.points}` : p.points}</b></li>)}
            </ul>
          </AdminCard>

          <AdminCard title="Տվյալներ">
            <ActionForm action={updateLead} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="stage" value={lead.stage} />
              <label className="label sm:col-span-2">Անուն<input name="name" defaultValue={lead.name} className="input" /></label>
              <label className="label">Հեռախոս<input name="phone" defaultValue={lead.phone ? `+${lead.phone}` : ""} className="input" /></label>
              <label className="label">Էլ. փոստ<input name="email" type="email" defaultValue={lead.email ?? ""} className="input" /></label>
              <label className="label">Telegram (username)<input name="telegramUsername" defaultValue={lead.telegramUsername ?? ""} className="input" /></label>
              <label className="label">Լեզու<select name="locale" defaultValue={lead.locale} className="input"><option value="hy">Հայերեն</option><option value="ru">Ռուսերեն</option><option value="en">Անգլերեն</option></select></label>
              <label className="label">Աղբյուր<select name="source" defaultValue={lead.source} className="input">{SOURCES.map((x) => <option key={x} value={x}>{sourceHy[x]}</option>)}</select></label>
              <label className="label">Դասընթաց<select name="courseId" defaultValue={lead.courseId ?? ""} className="input"><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {tr(c.title, "hy")}</option>)}</select></label>
              <label className="label">Ձևաչափ<select name="format" defaultValue={lead.format ?? ""} className="input"><option value="">—</option><option value="group">Խմբակային</option><option value="individual">Անհատական</option></select></label>
              <label className="label">Պիտակներ<input name="tags" defaultValue={lead.tags.join(", ")} className="input" /></label>
              <label className="label">Հաջորդ քայլ<input name="nextAction" defaultValue={lead.nextAction ?? ""} className="input" /></label>
              <label className="label">Հաջորդ քայլի ժամը (խորհրդատվություն, փորձնական դաս)<input name="nextActionAt" type="datetime-local" defaultValue={isoLocal(lead.nextActionAt)} className="input" /></label>
              <label className="label sm:col-span-2">Ներքին նշում<textarea name="note" rows={3} defaultValue={lead.note ?? ""} className="input py-2.5" /></label>
              <div className="sm:col-span-2"><Check name="marketingOptIn" label="Համաձայն է ստանալ նորություններ և առաջարկներ" defaultChecked={lead.marketingOptIn && !lead.unsubscribed} /></div>
              <p className="m-0 text-[12.5px] text-muted sm:col-span-2">Աղբյուր՝ {sourceLabel(lead.source, lead.utm)}{lead.utm?.landing ? ` · մուտքի էջ՝ ${lead.utm.landing}` : ""}{lead.utm?.referrer ? ` · ${lead.utm.referrer}` : ""} · ստեղծված՝ {dateShort(lead.createdAt)}{lead.lostReason ? ` · կորցնելու պատճառ՝ ${lead.lostReason}` : ""}</p>
              <div className="sm:col-span-2"><SubmitButton pendingText="Պահպանվում է…">Պահպանել</SubmitButton></div>
            </ActionForm>
          </AdminCard>

          {apps.length > 0 && (
            <AdminCard title="Հայտեր և վճարումներ" actions={<Link href="/admin/applications" className="text-[14px] font-semibold">Հայտեր →</Link>}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
                {apps.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                    <span className="flex-1 font-mono text-[13px]">{a.course.code}</span>
                    <span className="text-muted">վճարված {money(a.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amount, 0))}</span>
                    <span className={`chip font-semibold ${badge[a.status]}`}>{statusHy[a.status]}</span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}

          <form action={deleteLead} className="text-right">
            <input type="hidden" name="id" value={lead.id} />
            <button className="text-[13px] text-[#8a2f1d] underline">Ջնջել լիդը (անդառնալի)</button>
          </form>
        </div>
      </div>
    </>
  );
}
