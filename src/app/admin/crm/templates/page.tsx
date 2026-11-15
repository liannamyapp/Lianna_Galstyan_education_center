import { asc } from "drizzle-orm";
import { db, s } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { L10nInput, PageHead } from "@/components/admin/fields";
import { PLACEHOLDERS } from "@/lib/crm/constants";
import { ensureDefaultTemplates } from "@/lib/crm/leads";
import { deleteTemplate, saveTemplate } from "../actions";

export default async function Templates() {
  await ensureDefaultTemplates();
  const list = await db.select().from(s.crmTemplates).orderBy(asc(s.crmTemplates.createdAt));
  return (
    <>
      <PageHead title="Հաղորդագրությունների ձևանմուշներ" />
      <p className="card mb-5 p-4 text-[14px]">Տեքստերում կարող եք օգտագործել՝ <b>{PLACEHOLDERS.join("  ")}</b>։ Դրանք ինքնաբերաբար փոխարինվում են լիդի անունով, դասընթացով, մոտակա խմբի ամսաթվով, հղումով, ձեր հեռախոսով և կենտրոնի անունով։ Լիդը ստանում է իր լեզվով (ՀԱՅ / РУС / ENG) տարբերակը։ Ավտոմատացման ձևանմուշները (առանց «custom») ջնջել հնարավոր չէ, բայց կարող եք փոխել տեքստը։</p>
      <div className="flex flex-col gap-4">
        {list.map((t) => (
          <details key={t.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 [&::-webkit-details-marker]:hidden"><b className="flex-1 text-navy-900">{t.name}</b><code className="text-[12.5px] text-muted">{t.key}</code></summary>
            <ActionForm action={saveTemplate} className="grid gap-4 border-t border-[#eee7d8] p-5">
              <input type="hidden" name="id" value={t.id} />
              <label className="label">Անվանում<input name="name" defaultValue={t.name} className="input" /></label>
              <L10nInput name="subject" label="Թեմա (էլ. նամակի համար)" value={t.subject} />
              <L10nInput name="body" label="Տեքստ" value={t.body} textarea rows={5} required />
              <div className="flex flex-wrap items-center justify-between gap-3"><SubmitButton pendingText="Պահպանվում է…">Պահպանել</SubmitButton></div>
            </ActionForm>
            {t.key.startsWith("custom_") && <form action={deleteTemplate} className="px-5 pb-5"><input type="hidden" name="id" value={t.id} /><button className="text-[13px] text-[#8a2f1d] underline">Ջնջել</button></form>}
          </details>
        ))}
      </div>
      <section className="card mt-8 p-6">
        <h2 className="mb-4 text-[17px] font-semibold text-navy-900">Նոր ձևանմուշ</h2>
        <ActionForm action={saveTemplate} className="grid gap-4" resetOnSuccess>
          <label className="label">Անվանում<input name="name" required className="input" placeholder="օր.՝ Բաց դասի հրավեր" /></label>
          <L10nInput name="subject" label="Թեմա (էլ. նամակի համար)" />
          <L10nInput name="body" label="Տեքստ" textarea rows={5} required />
          <div><SubmitButton>Ավելացնել</SubmitButton></div>
        </ActionForm>
      </section>
    </>
  );
}
