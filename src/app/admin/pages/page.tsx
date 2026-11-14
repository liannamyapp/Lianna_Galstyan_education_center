import { db, s } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, L10nInput, PageHead } from "@/components/admin/fields";
import { savePage } from "../actions";

const SLUGS = [["contract", "Պայմանագրի օրինակ"], ["refund", "Վճարման և վերադարձի կանոններ"], ["privacy", "Գաղտնիության քաղաքականություն"]] as const;

export default async function Pages() {
  const rows = await db.select().from(s.pages);
  const by = new Map(rows.map((r) => [r.slug, r]));
  return (
    <>
      <PageHead title="Փաստաթղթեր (էջեր)" />
      <p className="-mt-3 mb-5 text-[14px] text-muted">Տեքստը գրվում է Markdown-ով։ «Պայմանագրի օրինակը» նաև ավտոմատ ցուցադրվում է յուրաքանչյուր ունկնդրի անձնական պայմանագրում։</p>
      <div className="flex flex-col gap-5">
        {SLUGS.map(([slug, label]) => (
          <AdminCard key={slug} title={label}>
            <ActionForm action={savePage} className="flex flex-col gap-4">
              <input type="hidden" name="slug" value={slug} />
              <L10nInput name="title" label="Վերնագիր" value={by.get(slug)?.title ?? { hy: label, ru: "", en: "" }} required />
              <L10nInput name="body" label="Տեքստ" value={by.get(slug)?.body} textarea rows={12} />
              <SubmitButton className="btn-navy self-start" pendingText="…">Պահպանել</SubmitButton>
            </ActionForm>
          </AdminCard>
        ))}
      </div>
    </>
  );
}
