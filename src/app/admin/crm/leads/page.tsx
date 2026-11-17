import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db, s } from "@/db";
import type { LeadStage } from "@/db/schema";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHead, th, td } from "@/components/admin/fields";
import { LeadLink, ScoreBadge, StageBadge, relTime, sourceLabel } from "@/components/admin/crm";
import { SOURCES, STAGES, sourceHy, stageHy } from "@/lib/crm/constants";
import { prettyPhone } from "@/lib/crm/leads";
import { createLead } from "../actions";

type SP = { q?: string; stage?: string; source?: string; temp?: string; course?: string; tag?: string; page?: string; new?: string };

export default async function Leads({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const conds: SQL[] = [];
  if (sp.q) {
    const q = `%${sp.q.trim()}%`, digits = sp.q.replace(/\D/g, "");
    conds.push(or(ilike(s.leads.name, q), ilike(s.leads.email, q), ilike(s.leads.telegramUsername, q), ...(digits.length >= 4 ? [ilike(s.leads.phone, `%${digits}%`)] : []))!);
  }
  if (sp.stage && (STAGES as string[]).includes(sp.stage)) conds.push(eq(s.leads.stage, sp.stage as LeadStage));
  if (sp.source) conds.push(eq(s.leads.source, sp.source));
  if (sp.course) conds.push(eq(s.leads.courseId, sp.course));
  if (sp.tag) conds.push(sql`${s.leads.tags} ? ${sp.tag}`);
  if (sp.temp === "hot") conds.push(gte(s.leads.score, 70));
  if (sp.temp === "warm") conds.push(and(gte(s.leads.score, 40), lt(s.leads.score, 70))!);
  if (sp.temp === "cold") conds.push(lt(s.leads.score, 40));
  const where = conds.length ? and(...conds) : undefined;

  const [list, [{ n }], courses] = await Promise.all([
    db.query.leads.findMany({ where, with: { course: true }, orderBy: [desc(s.leads.createdAt)], limit: 100, offset: (page - 1) * 100 }),
    db.select({ n: sql<number>`count(*)::int` }).from(s.leads).where(where),
    db.select({ id: s.courses.id, code: s.courses.code, title: s.courses.title }).from(s.courses).orderBy(asc(s.courses.order)),
  ]);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch, new: undefined }).filter(([, v]) => v) as [string, string][]);
    return `/admin/crm/leads${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHead title={`Լիդեր · ${n}`}>
        <a href="#new" className="btn-navy min-h-11">+ Նոր լիդ</a>
      </PageHead>

      <form className="card mb-5 grid gap-3 p-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]" role="search">
        <label className="label">Որոնում<input name="q" defaultValue={sp.q} placeholder="Անուն, հեռախոս, էլ. փոստ" className="input" /></label>
        <label className="label">Փուլ<select name="stage" defaultValue={sp.stage ?? ""} className="input"><option value="">Բոլորը</option>{STAGES.map((x) => <option key={x} value={x}>{stageHy[x]}</option>)}</select></label>
        <label className="label">Աղբյուր<select name="source" defaultValue={sp.source ?? ""} className="input"><option value="">Բոլորը</option>{SOURCES.map((x) => <option key={x} value={x}>{sourceHy[x]}</option>)}</select></label>
        <label className="label">Ջերմություն<select name="temp" defaultValue={sp.temp ?? ""} className="input"><option value="">Բոլորը</option><option value="hot">Տաք (70+)</option><option value="warm">Գոլ (40–69)</option><option value="cold">Սառը (&lt;40)</option></select></label>
        <label className="label">Դասընթաց<select name="course" defaultValue={sp.course ?? ""} className="input"><option value="">Բոլորը</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select></label>
        <label className="label">Պիտակ<input name="tag" defaultValue={sp.tag} className="input" /></label>
        <div className="flex items-end gap-2"><button className="btn-navy min-h-12 flex-1">Ֆիլտրել</button><Link href="/admin/crm/leads" className="btn-soft min-h-12">Մաքրել</Link></div>
      </form>

      <div className="card overflow-x-auto">
        <table className="rtable w-full min-w-[920px] border-collapse">
          <thead><tr><th className={th}>Լիդ</th><th className={th}>Փուլ</th><th className={th}>Գնահատական</th><th className={th}>Աղբյուր</th><th className={th}>Դասընթաց</th><th className={th}>Հաջորդ քայլ</th><th className={th}>Ստեղծված</th></tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td data-label="Լիդ" className={td}><LeadLink id={l.id} name={l.name} /><br /><span className="text-[13px] text-muted">{[prettyPhone(l.phone), l.email, l.telegramUsername && `@${l.telegramUsername}`].filter(Boolean).join(" · ") || "—"}</span>{l.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{l.tags.map((t) => <Link key={t} href={qs({ tag: t, page: undefined })} className="chip bg-[#f3f1ec] text-[12px] text-[#4b5563] no-underline">#{t}</Link>)}</div>}</td>
                <td data-label="Փուլ" className={td}><StageBadge stage={l.stage} /></td>
                <td data-label="Գնահատական" className={td}><ScoreBadge score={l.score} /></td>
                <td data-label="Աղբյուր" className={`${td} text-[13px]`}>{sourceLabel(l.source, l.utm)}</td>
                <td data-label="Դասընթաց" className={`${td} font-mono text-[13px]`}>{l.course?.code ?? "—"}</td>
                <td data-label="Հաջորդ քայլ" className={`${td} text-[13px]`}>{l.nextAction ?? <span className="text-muted">—</span>}{l.nextActionAt && <><br /><span className={l.nextActionAt.getTime() < Date.now() ? "font-semibold text-[#8a2f1d]" : "text-muted"}>{relTime(l.nextActionAt)}</span></>}</td>
                <td data-label="Ստեղծված" className={`${td} text-[13px] text-muted`}>{dateShort(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-muted">Լիդեր չկան։ Կարող եք ավելացնել ձեռքով կամ ներմուծել կայքի տվյալները «Ավտոմատացում և ալիքներ» բաժնից։</p>}
      </div>
      {n > 100 && (
        <nav className="mt-4 flex gap-2" aria-label="Էջեր">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn-soft min-h-10">← Նախորդ</Link>}
          <span className="chip min-h-10 bg-white px-4">{page} / {Math.ceil(n / 100)}</span>
          {page * 100 < n && <Link href={qs({ page: String(page + 1) })} className="btn-soft min-h-10">Հաջորդ →</Link>}
        </nav>
      )}

      <section id="new" className="card mt-8 scroll-mt-6 p-6">
        <h2 className="mb-4 text-[17px] font-semibold text-navy-900">Նոր լիդ (զանգ, այց, միջոցառում…)</h2>
        <ActionForm action={createLead} className="grid gap-4 md:grid-cols-3">
          <label className="label">Անուն *<input name="name" required minLength={2} className="input" /></label>
          <label className="label">Հեռախոս<input name="phone" type="tel" placeholder="077 12 34 56" className="input" /></label>
          <label className="label">Էլ. փոստ<input name="email" type="email" className="input" /></label>
          <label className="label">Աղբյուր<select name="source" defaultValue="phone_call" className="input">{SOURCES.map((x) => <option key={x} value={x}>{sourceHy[x]}</option>)}</select></label>
          <label className="label">Դասընթաց<select name="courseId" className="input"><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {tr(c.title, "hy")}</option>)}</select></label>
          <label className="label">Ձևաչափ<select name="format" className="input"><option value="">—</option><option value="group">Խմբակային</option><option value="individual">Անհատական</option></select></label>
          <label className="label">Լեզու<select name="locale" className="input"><option value="hy">Հայերեն</option><option value="ru">Ռուսերեն</option><option value="en">Անգլերեն</option></select></label>
          <label className="label md:col-span-2">Պիտակներ (ստորակետով)<input name="tags" placeholder="օր.՝ ուսանող, բաց դաս" className="input" /></label>
          <label className="label md:col-span-3">Ինչ է ուզում / նշում<textarea name="note" rows={2} className="input py-2.5" /></label>
          <div className="md:col-span-3"><SubmitButton pendingText="Ավելացվում է…">Ավելացնել լիդը</SubmitButton></div>
        </ActionForm>
      </section>
    </>
  );
}
