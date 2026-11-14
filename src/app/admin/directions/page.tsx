import { asc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { iconNames } from "@/components/Icon";
import { Icon } from "@/components/Icon";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, L10nInput, PageHead } from "@/components/admin/fields";
import { deleteDirection, saveDirection } from "../actions";

type D = typeof s.directions.$inferSelect;

function DirForm({ d }: { d?: D }) {
  return (
    <ActionForm action={saveDirection} resetOnSuccess={!d} className="flex flex-col gap-4">
      {d && <input type="hidden" name="id" value={d.id} />}
      <L10nInput name="title" label="Անվանում" value={d?.title} required />
      <L10nInput name="description" label="Կարճ նկարագրություն" value={d?.description} textarea rows={2} />
      <div className="flex flex-wrap items-end gap-4">
        <label className="label w-[200px]">URL (slug)<input name="slug" defaultValue={d?.slug} placeholder="programming" className="input" /></label>
        <label className="label w-[180px]">Պատկերակ<select name="icon" defaultValue={d?.icon ?? "code"} className="input">{iconNames.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label className="label w-[120px]">Հերթականություն<input name="order" type="number" defaultValue={d?.order ?? 0} className="input" /></label>
        <Check name="published" label="Հրապարակված" defaultChecked={d?.published ?? true} />
        <SubmitButton pendingText="…">{d ? "Պահպանել" : "Ավելացնել ուղղություն"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function Directions() {
  const list = await db.select().from(s.directions).orderBy(asc(s.directions.order));
  return (
    <>
      <PageHead title="Ուղղություններ" />
      <p className="-mt-3 mb-5 text-[14px] text-muted">Ուղղությունը մասնագիտության խումբ է (օր.՝ Ծրագրավորում, Դիզայն)։ Դասընթացները կցվում են ուղղությանը։</p>
      <div className="flex flex-col gap-4">
        {list.map((d) => (
          <details key={d.id} className="card">
            <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex size-10 items-center justify-center rounded-xl bg-navy-800 text-gold-300"><Icon name={d.icon} /></span>
              <b className="flex-1">{tr(d.title, "hy")}</b>
              <span className={`chip font-semibold ${d.published ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#eef0f3] text-[#4b5563]"}`}>{d.published ? "Հրապարակված" : "Թաքցված"}</span>
            </summary>
            <div className="border-t border-[#eee7d8] p-5">
              <DirForm d={d} />
              <form action={deleteDirection} className="mt-3"><input type="hidden" name="id" value={d.id} /><button className="text-[13px] text-[#8a2f1d]">Ջնջել (միայն եթե դասընթացներ չունի)</button></form>
            </div>
          </details>
        ))}
        <AdminCard title="+ Նոր ուղղություն"><DirForm /></AdminCard>
      </div>
    </>
  );
}
