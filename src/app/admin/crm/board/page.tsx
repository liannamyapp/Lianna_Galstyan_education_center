import { and, desc, gte, inArray, or } from "drizzle-orm";
import { db, s } from "@/db";
import { PageHead } from "@/components/admin/fields";
import { LeadLink, ScoreBadge, relTime } from "@/components/admin/crm";
import { OPEN_STAGES, STAGES, stageCls, stageHy, sourceHy } from "@/lib/crm/constants";
import { prettyPhone } from "@/lib/crm/leads";
import { moveLead } from "../actions";

export default async function Board() {
  const month = new Date(Date.now() - 30 * 86_400_000);
  const leads = await db.query.leads.findMany({
    where: or(inArray(s.leads.stage, OPEN_STAGES), and(inArray(s.leads.stage, ["WON", "LOST"]), gte(s.leads.stageChangedAt, month))),
    with: { course: true }, orderBy: [desc(s.leads.score)], limit: 600,
  });
  return (
    <>
      <PageHead title="Վաճառքի խողովակ"><span className="text-[13px] text-muted">«Գրանցված» և «Կորցրած» սյունակներում՝ վերջին 30 օրը</span></PageHead>
      <div className="grid gap-4 pb-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {STAGES.map((st) => {
          const col = leads.filter((l) => l.stage === st);
          return (
            <section key={st} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-[#ebe7de] p-3" aria-label={stageHy[st]}>
              <h2 className="flex items-center justify-between px-1 text-[14px] font-semibold"><span className={`chip ${stageCls[st]}`}>{stageHy[st]}</span><span className="text-muted">{col.length}</span></h2>
              {col.map((l) => (
                <article key={l.id} className="card flex flex-col gap-2 p-3 text-[13.5px]">
                  <div className="flex items-start justify-between gap-2"><LeadLink id={l.id} name={l.name} /><ScoreBadge score={l.score} /></div>
                  <span className="text-muted">{[l.course?.code, sourceHy[l.source] ?? l.source].filter(Boolean).join(" · ")}</span>
                  {(l.phone || l.email) && <span className="text-muted">{prettyPhone(l.phone) || l.email}</span>}
                  {l.nextAction && <span>➜ {l.nextAction}{l.nextActionAt && <span className={l.nextActionAt.getTime() < Date.now() ? " font-semibold text-[#8a2f1d]" : " text-muted"}> · {relTime(l.nextActionAt)}</span>}</span>}
                  <form action={moveLead} className="flex gap-1.5">
                    <input type="hidden" name="id" value={l.id} />
                    <select name="stage" defaultValue={st} aria-label="Փուլ" className="input min-h-9 flex-1 px-2 text-[13px]">{STAGES.map((x) => <option key={x} value={x}>{stageHy[x]}</option>)}</select>
                    <button className="btn-soft min-h-9 px-3 text-[13px]">→</button>
                  </form>
                </article>
              ))}
              {col.length === 0 && <p className="px-1 text-[13px] text-muted">Դատարկ է</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
