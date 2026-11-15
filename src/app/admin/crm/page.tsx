import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { money } from "@/lib/format";
import { AdminCard, PageHead } from "@/components/admin/fields";
import { Bar, LeadLink, ScoreBadge, StageBadge, relTime } from "@/components/admin/crm";
import { OPEN_STAGES, STAGES, sourceHy, stageHy } from "@/lib/crm/constants";
import { prettyPhone } from "@/lib/crm/leads";
import { toggleTask } from "./actions";

const DAY = 86_400_000;

export default async function CrmDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = Math.min(365, Math.max(7, Number((await searchParams).days) || 30));
  const since = new Date(Date.now() - days * DAY);
  const endOfToday = new Date(Date.now() + DAY);

  const [period, byStage, tasks, hot, untouched, revenue] = await Promise.all([
    db.select().from(s.leads).where(gte(s.leads.createdAt, since)),
    db.select({ stage: s.leads.stage, n: sql<number>`count(*)::int` }).from(s.leads).groupBy(s.leads.stage),
    db.query.crmTasks.findMany({ where: and(eq(s.crmTasks.done, false), lte(s.crmTasks.dueAt, endOfToday)), with: { lead: true }, orderBy: [asc(s.crmTasks.dueAt)], limit: 25 }),
    db.select().from(s.leads).where(and(inArray(s.leads.stage, OPEN_STAGES), gte(s.leads.score, 70))).orderBy(desc(s.leads.score)).limit(8),
    db.select().from(s.leads).where(and(eq(s.leads.stage, "NEW"), isNull(s.leads.firstResponseAt))).orderBy(asc(s.leads.createdAt)).limit(8),
    // revenue from learners who came through the CRM, per lead source
    db.select({ source: s.leads.source, amount: sql<number>`coalesce(sum(${s.payments.amount}),0)::int` })
      .from(s.payments).innerJoin(s.leads, eq(s.leads.userId, s.payments.userId))
      .where(and(eq(s.payments.status, "PAID"), gte(s.payments.paidAt, since))).groupBy(s.leads.source),
  ]);

  const total = period.length;
  const won = period.filter((l) => l.stage === "WON").length;
  const lost = period.filter((l) => l.stage === "LOST").length;
  const conv = total ? Math.round((won / total) * 100) : 0;
  const responses = period.filter((l) => l.firstResponseAt).map((l) => (new Date(l.firstResponseAt!).getTime() - new Date(l.createdAt).getTime()) / 60000).sort((a, b) => a - b);
  const median = responses.length ? responses[Math.floor(responses.length / 2)] : null;
  const revTotal = revenue.reduce((n, r) => n + r.amount, 0);
  const stageCount = Object.fromEntries(byStage.map((r) => [r.stage, r.n])) as Record<string, number>;
  const maxStage = Math.max(1, ...STAGES.map((st) => stageCount[st] ?? 0));

  // sources: leads, won, conversion, revenue
  const src = new Map<string, { n: number; won: number }>();
  for (const l of period) {
    const k = l.utm?.source ? `${l.source}|${l.utm.source}` : l.source;
    const v = src.get(k) ?? { n: 0, won: 0 };
    v.n++; if (l.stage === "WON") v.won++;
    src.set(k, v);
  }
  const revBy = new Map(revenue.map((r) => [r.source, r.amount]));
  const sources = [...src.entries()].sort((a, b) => b[1].n - a[1].n);
  const maxSrc = Math.max(1, ...sources.map(([, v]) => v.n));
  const overdue = tasks.filter((t) => t.dueAt.getTime() < Date.now()).length;

  const kpi: [string, string | number, string?][] = [
    [`Նոր լիդեր (${days} օր)`, total],
    ["Գրանցում (փոխարկում)", `${conv}%`, `${won} գրանցված · ${lost} կորցրած`],
    ["Եկամուտ լիդերից", money(revTotal)],
    ["Առաջին արձագանքի միջին ժամանակ", median === null ? "—" : median < 60 ? `${Math.round(median)} րոպե` : `${Math.round(median / 60)} ժամ`, "նպատակ՝ մինչև 15 րոպե"],
    ["Ակտիվ խողովակում", OPEN_STAGES.reduce((n, st) => n + (stageCount[st] ?? 0), 0)],
    ["Առաջադրանքներ այսօր", tasks.length, overdue ? `${overdue} ուշացած` : "ուշացած չկա"],
  ];

  return (
    <>
      <PageHead title="CRM · Վաճառքներ">
        {[7, 30, 90, 365].map((d) => <Link key={d} href={`/admin/crm?days=${d}`} className={`chip min-h-10 px-4 no-underline ${d === days ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>{d === 365 ? "Տարի" : `${d} օր`}</Link>)}
        <Link href="/admin/crm/leads?new=1" className="btn-navy min-h-11">+ Նոր լիդ</Link>
      </PageHead>

      <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {kpi.map(([l, v, sub]) => (
          <div key={l} className="card p-5"><span className="text-[13px] text-muted">{l}</span><span className="mt-1 block font-serif text-[26px] font-bold text-navy-900">{v}</span>{sub && <span className="text-[12.5px] text-muted">{sub}</span>}</div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Այսօր անել" actions={<Link href="/admin/crm/tasks" className="text-[14px] font-semibold">Բոլորը →</Link>}>
          {tasks.length === 0 ? <p className="text-muted">Այսօրվա համար առաջադրանքներ չկան 🎉</p> : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <form action={toggleTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value="1" /><button aria-label="Կատարված" className="flex size-7 items-center justify-center rounded-full border-2 border-navy-800 text-navy-800 hover:bg-navy-800 hover:text-white">✓</button></form>
                  <span className="min-w-0 flex-1 text-[14px]">{t.title}{t.lead && <> · <LeadLink id={t.lead.id} name={t.lead.name} /></>}</span>
                  <span className={`text-[12.5px] ${t.dueAt.getTime() < Date.now() ? "font-semibold text-[#8a2f1d]" : "text-muted"}`}>{relTime(t.dueAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Դեռ չեն ստացել պատասխան" actions={<span className="text-[13px] text-muted">Ամենաշատը կորցնում ենք այստեղ</span>}>
          {untouched.length === 0 ? <p className="text-muted">Բոլոր նոր լիդերին արդեն պատասխանել եք։</p> : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {untouched.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-[14px]">
                  <span className="min-w-0 flex-1"><LeadLink id={l.id} name={l.name} /><br /><span className="text-muted">{sourceHy[l.source] ?? l.source} · {prettyPhone(l.phone) || l.email}</span></span>
                  <span className="font-semibold text-[#8a2f1d]">{relTime(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Վաճառքի խողովակ (այժմ)" actions={<Link href="/admin/crm/board" className="text-[14px] font-semibold">Բացել →</Link>}>
          <div className="flex flex-col gap-2.5">
            {STAGES.map((st) => <Bar key={st} label={stageHy[st]} value={stageCount[st] ?? 0} max={maxStage} tone={st === "WON" ? "bg-[#2f7a46]" : st === "LOST" ? "bg-[#b5533c]" : "bg-navy-800"} />)}
          </div>
        </AdminCard>

        <AdminCard title={`Աղբյուրներ (${days} օր)`} actions={<span className="text-[13px] text-muted">լիդեր · գրանցում · եկամուտ</span>}>
          {sources.length === 0 ? <p className="text-muted">Այս ժամանակահատվածում լիդեր չկան։</p> : (
            <div className="flex flex-col gap-2.5">
              {sources.map(([k, v]) => {
                const [source, utm] = k.split("|");
                const rev = utm ? 0 : revBy.get(source) ?? 0;
                return <Bar key={k} label={`${sourceHy[source] ?? source}${utm ? ` · ${utm}` : ""}`} value={v.n} max={maxSrc} tone="bg-gold-500" extra={`· ${v.n ? Math.round((v.won / v.n) * 100) : 0}%${rev ? ` · ${money(rev)}` : ""}`} />;
              })}
            </div>
          )}
        </AdminCard>

        <AdminCard title="Տաք լիդեր" actions={<Link href="/admin/crm/leads?temp=hot" className="text-[14px] font-semibold">Բոլորը →</Link>}>
          {hot.length === 0 ? <p className="text-muted">Տաք լիդեր դեռ չկան։</p> : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {hot.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-[14px]">
                  <span className="min-w-0 flex-1"><LeadLink id={l.id} name={l.name} /><br /><span className="text-muted">{l.nextAction ?? "Հաջորդ քայլը նշված չէ"}</span></span>
                  <StageBadge stage={l.stage} /><ScoreBadge score={l.score} />
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  );
}
