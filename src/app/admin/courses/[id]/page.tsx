import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { listToText } from "@/lib/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { ModulesEditor } from "@/components/admin/ModulesEditor";
import { AdminCard, Check, Field, L10nInput, PageHead } from "@/components/admin/fields";
import { deleteCourse, saveCourse } from "../../actions";

export default async function EditCourse({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const isNew = id === "new";
  const c = isNew ? null : await db.query.courses.findFirst({ where: eq(s.courses.id, id), with: { modules: { orderBy: [asc(s.courseModules.order)] } } });
  if (!isNew && !c) notFound();
  const dirs = await db.select().from(s.directions).orderBy(asc(s.directions.order));
  return (
    <>
      <PageHead title={isNew ? "Նոր դասընթաց" : `${c!.code} · ${tr(c!.title, "hy")}`}>
        {!isNew && <Link href={`/hy/courses/${c!.slug}`} target="_blank" className="btn-soft min-h-11">Դիտել կայքում</Link>}
        <Link href="/admin/courses" className="btn-soft min-h-11">← Ցանկ</Link>
      </PageHead>
      {saved && <p role="status" className="mb-4 rounded-xl bg-[#eef7f0] px-4 py-3 text-[14px] text-[#1f5f33]">Պահպանված է։ Փոփոխությունները երևում են կայքում։</p>}
      <ActionForm action={saveCourse} className="flex flex-col gap-5">
        {c && <input type="hidden" name="id" value={c.id} />}
        <AdminCard title="Հիմնական">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Կոդ (որակիչ)"><input name="code" required defaultValue={c?.code} placeholder="ՖՎԾ-01" className="input" /></Field>
              <Field label="URL (slug)"><input name="slug" defaultValue={c?.slug} placeholder="frontend" className="input" /></Field>
              <Field label="Ուղղություն"><select name="directionId" required defaultValue={c?.directionId} className="input">{dirs.map((d) => <option key={d.id} value={d.id}>{tr(d.title, "hy")}</option>)}</select></Field>
              <Field label="Հերթականություն"><input name="order" type="number" defaultValue={c?.order ?? 0} className="input" /></Field>
            </div>
            <L10nInput name="title" label="Անվանում" value={c?.title} required />
            <L10nInput name="summary" label="Կարճ նկարագրություն (քարտում և Google-ում)" value={c?.summary} textarea rows={2} required />
            <L10nInput name="level" label="Մակարդակ (օր.՝ Սկսնակների համար)" value={c?.level} />
            <L10nInput name="description" label="Մանրամասն նկարագրություն (ոչ պարտադիր)" value={c?.description} textarea rows={4} />
          </div>
        </AdminCard>
        <AdminCard title="Գին և տևողություն">
          <p className="-mt-2 mb-4 text-[13.5px] text-muted">Նոր գինը կիրառվում է միայն նոր հայտերի համար։ Արդեն վճարած ունկնդիրների գինը ամրագրված է իրենց պայմանագրում։</p>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Խմբակային՝ ամսական (֏)"><input name="priceMonthly" type="number" min={0} required defaultValue={c?.priceMonthly ?? 50000} className="input" /></Field>
            <Field label="Խմբակային՝ ամբողջ գին (֏, ոչ պարտադիր)"><input name="priceFull" type="number" min={0} defaultValue={c?.priceFull ?? ""} className="input" /></Field>
            <Field label="Անհատական՝ ամսական (֏)"><input name="priceIndividual" type="number" min={0} required defaultValue={c?.priceIndividual ?? 125000} className="input" /></Field>
            <Field label="Անհատական՝ ամբողջ գին (֏, ոչ պարտադիր)"><input name="priceIndividualFull" type="number" min={0} defaultValue={c?.priceIndividualFull ?? ""} className="input" /></Field>
            <Field label="Ամսական վճարումների քանակ"><input name="months" type="number" min={1} max={24} required defaultValue={c?.months ?? 3} className="input" /></Field>
            <Field label="Ակադեմիական ժամ"><input name="hours" type="number" min={1} required defaultValue={c?.hours} className="input" /></Field>
            <Field label="Շաբաթ"><input name="weeks" type="number" min={1} required defaultValue={c?.weeks} className="input" /></Field>
            <Field label="Տեսական ժամ"><input name="theoryHours" type="number" min={0} defaultValue={c?.theoryHours ?? 0} className="input" /></Field>
            <Field label="Գործնական ժամ"><input name="practiceHours" type="number" min={0} defaultValue={c?.practiceHours ?? 0} className="input" /></Field>
            <Field label="Դաս շաբաթական"><input name="lessonsPerWeek" type="number" min={1} defaultValue={c?.lessonsPerWeek ?? 3} className="input" /></Field>
            <Field label="Նվազագույն տարիք"><input name="minAge" type="number" min={0} defaultValue={c?.minAge ?? 16} className="input" /></Field>
          </div>
        </AdminCard>
        <AdminCard title="Ծրագիր">
          <div className="flex flex-col gap-4">
            <ModulesEditor initial={(c?.modules ?? []).map((m) => ({ code: m.code, hours: m.hours, hy: m.title.hy, ru: m.title.ru, en: m.title.en }))} />
            <L10nInput name="outcomes" label="Ուսումնառության արդյունքներ (յուրաքանչյուրը նոր տողով)" value={listToText(c?.outcomes)} textarea rows={5} />
            <L10nInput name="requirements" label="Մուտքային պահանջներ" value={c?.requirements} textarea rows={2} />
          </div>
        </AdminCard>
        <AdminCard title="Պատկերներ և երաշխավորում">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Նկար (Google / սոցցանցեր)"><input type="file" name="image" accept="image/*" className="text-[14px]" />{c?.imageUrl && <Image src={c.imageUrl} alt="" width={160} height={90} className="mt-2 rounded-lg" />}</Field>
            <Field label="Վկայականի նմուշ (նկար)"><input type="file" name="certificate" accept="image/*" className="text-[14px]" />{c?.certificateUrl && <Image src={c.certificateUrl} alt="" width={90} height={127} className="mt-2 rounded" />}</Field>
            <Field label="Երաշխավորման նշում"><input name="endorsement" defaultValue={c?.endorsement ?? ""} placeholder="ՀՀ ԿԳՄՍՆ երաշխավորում՝ № …, ամսաթիվ" className="input" /></Field>
          </div>
        </AdminCard>
        <div className="flex flex-wrap items-center gap-5">
          <Check name="published" label="Հրապարակված" defaultChecked={c?.published ?? true} />
          <Check name="featured" label="Ցույց տալ գլխավոր էջում" defaultChecked={c?.featured ?? true} />
          <SubmitButton className="btn-navy px-8" pendingText="Պահպանվում է…">Պահպանել դասընթացը</SubmitButton>
        </div>
      </ActionForm>
      {c && (
        <form action={deleteCourse} className="mt-8 border-t border-line pt-5">
          <input type="hidden" name="id" value={c.id} />
          <button className="text-[13.5px] text-[#8a2f1d]">Ջնջել դասընթացը (եթե հայտեր ունի՝ միայն կթաքցվի)</button>
        </form>
      )}
    </>
  );
}
