import { asc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, L10nInput, PageHead } from "@/components/admin/fields";
import { deleteFaq, saveFaq } from "../actions";

type F = typeof s.faqs.$inferSelect;
function FaqForm({ f }: { f?: F }) {
  return (
    <ActionForm action={saveFaq} resetOnSuccess={!f} className="flex flex-col gap-4">
      {f && <input type="hidden" name="id" value={f.id} />}
      <L10nInput name="question" label="Հարց" value={f?.question} required />
      <L10nInput name="answer" label="Պատասխան" value={f?.answer} textarea rows={3} required />
      <div className="flex flex-wrap items-end gap-4">
        <label className="label w-[140px]">Հերթականություն<input name="order" type="number" defaultValue={f?.order ?? 0} className="input" /></label>
        <Check name="published" label="Հրապարակված" defaultChecked={f?.published ?? true} />
        <SubmitButton pendingText="…">{f ? "Պահպանել" : "Ավելացնել"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
export default async function Faq() {
  const list = await db.select().from(s.faqs).orderBy(asc(s.faqs.order));
  return (
    <>
      <PageHead title="Հաճախ տրվող հարցեր" />
      <div className="flex flex-col gap-3">
        {list.map((f) => (
          <details key={f.id} className="card"><summary className="cursor-pointer list-none p-5 font-semibold [&::-webkit-details-marker]:hidden">{tr(f.question, "hy")}</summary>
            <div className="border-t border-[#eee7d8] p-5"><FaqForm f={f} /><form action={deleteFaq} className="mt-3"><input type="hidden" name="id" value={f.id} /><button className="text-[13px] text-[#8a2f1d]">Ջնջել</button></form></div>
          </details>
        ))}
        <AdminCard title="+ Նոր հարց"><FaqForm /></AdminCard>
      </div>
    </>
  );
}
