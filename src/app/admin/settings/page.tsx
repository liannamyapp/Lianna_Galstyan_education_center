import Image from "next/image";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, Field, L10nInput, PageHead } from "@/components/admin/fields";
import { saveSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const st = await getSettings();
  const stats = [0, 1, 2, 3].map((i) => st.stats[i] ?? { value: "", label: { hy: "", ru: "", en: "" } });
  return (
    <>
      <PageHead title="Կայքի կարգավորումներ" />
      <p className="-mt-3 mb-5 text-[14px] text-muted">Այստեղ փոխվում է կայքի ողջ ընդհանուր բովանդակությունը՝ առանց ծրագրավորողի։ Փոփոխությունները կայքում երևում են անմիջապես պահպանելուց հետո։</p>
      <ActionForm action={saveSettings} className="flex flex-col gap-5">
        <AdminCard title="Կայքի անվանում և SEO">
          <div className="flex flex-col gap-4">
            <L10nInput name="siteName" label="Անվանում" value={st.site.name} required />
            <L10nInput name="tagline" label="Ենթավերնագիր (լոգոյի տակ)" value={st.site.tagline} />
            <L10nInput name="description" label="Նկարագրություն Google-ի համար (մինչև 160 նիշ)" value={st.site.description} textarea rows={2} />
          </div>
        </AdminCard>
        <AdminCard title="Գլխավոր էջի առաջին էկրան">
          <div className="flex flex-col gap-4">
            <L10nInput name="heroEyebrow" label="Վերին փոքր տող" value={st.hero.eyebrow} />
            <L10nInput name="heroTitle" label="Մեծ վերնագիր" value={st.hero.title} required />
            <L10nInput name="heroSubtitle" label="Ենթատեքստ" value={st.hero.subtitle} textarea rows={2} />
          </div>
        </AdminCard>
        <AdminCard title="Թվեր (4 բլոկ)">
          <div className="flex flex-col gap-5">
            {stats.map((x, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-[140px_1fr]">
                <Field label={`Թիվ ${i + 1}`}><input name={`stat${i}_value`} defaultValue={x.value} className="input font-serif text-[18px]" /></Field>
                <L10nInput name={`stat${i}`} label="Բացատրություն" value={x.label} />
              </div>
            ))}
          </div>
        </AdminCard>
        <AdminCard title="Դասավանդող">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-5">
              <Image src={st.instructor.photoUrl} alt="" width={96} height={96} className="size-24 rounded-2xl object-cover" />
              <Field label="Նոր լուսանկար (JPG/PNG/WebP)"><input type="file" name="instructorPhoto" accept="image/*" className="text-[14px]" /></Field>
              <input type="hidden" name="instructorPhotoUrl" value={st.instructor.photoUrl} />
            </div>
            <L10nInput name="instName" label="Անուն, ազգանուն" value={st.instructor.name} required />
            <L10nInput name="instRole" label="Պաշտոն" value={st.instructor.role} />
            <L10nInput name="instBio" label="Կենսագրություն" value={st.instructor.bio} textarea rows={5} />
            <Field label="Հմտություններ (յուրաքանչյուրը նոր տողից)"><textarea name="instTags" rows={4} defaultValue={st.instructor.tags.join("\n")} className="input" /></Field>
          </div>
        </AdminCard>
        <AdminCard title="Կոնտակտներ և սոցցանցեր">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Հեռախոս"><input name="phone" defaultValue={st.contacts.phone} className="input" /></Field>
            <Field label="Էլ. փոստ (կայքում)"><input name="email" type="email" defaultValue={st.contacts.email} className="input" /></Field>
            <Field label="Telegram (առանց @)"><input name="telegram" defaultValue={st.contacts.telegram} className="input" /></Field>
            <Field label="WhatsApp (միայն թվեր, օր.՝ 37477053446)"><input name="whatsapp" defaultValue={st.contacts.whatsapp} className="input" /></Field>
            <Field label="Instagram (ամբողջական հղում)"><input name="instagram" type="url" defaultValue={st.contacts.instagram} className="input" /></Field>
            <Field label="Facebook (ամբողջական հղում)"><input name="facebook" type="url" defaultValue={st.contacts.facebook} className="input" /></Field>
          </div>
          <div className="mt-4"><L10nInput name="city" label="Հասցե / ձևաչափ" value={st.contacts.city} /></div>
        </AdminCard>
        <AdminCard title="Իրավաբանական տվյալներ">
          <div className="flex flex-col gap-4">
            <L10nInput name="entity" label="Իրավաբանական անվանում" value={st.legal.entity} required />
            <Field label="ՀՎՀՀ"><input name="tin" defaultValue={st.legal.tin} className="input max-w-[240px]" /></Field>
            <L10nInput name="endorsement" label="ԿԳՄՍՆ երաշխավորություն (լրացրեք ստանալուց հետո, օր.՝ «Երաշխավորված է ԿԳՄՍՆ կողմից, հրաման № …»)" value={st.legal.endorsement} />
          </div>
        </AdminCard>
        <AdminCard title="Վճարումներ և ծանուցումներ">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Հիշեցում վճարումից քանի օր առաջ"><input name="reminderDays" type="number" min={1} max={20} defaultValue={st.payments.reminderDays} className="input max-w-[160px]" /></Field>
              <Field label="Ուշացման քանի օրից հետո դադարեցնել դասերի և տեսադասերի մուտքը"><input name="graceDays" type="number" min={0} max={60} defaultValue={st.payments.graceDays} className="input max-w-[160px]" /></Field>
            </div>
            <div className="flex flex-wrap gap-6"><Check name="payCard" label="Բանկային քարտ (Ameriabank vPOS)" defaultChecked={st.payments.card} /><Check name="payIdram" label="Idram" defaultChecked={st.payments.idram} /></div>
            <Field label="Էլ. փոստ, որին գալիս են հայտերի, վճարումների և հաղորդագրությունների ծանուցումները"><input name="adminEmail" type="email" defaultValue={st.adminEmail} className="input max-w-[420px]" /></Field>
          </div>
        </AdminCard>
        <div className="sticky bottom-4 z-10"><SubmitButton className="btn-gold px-10 shadow-lg" pendingText="Պահպանվում է…">Պահպանել բոլոր կարգավորումները</SubmitButton></div>
      </ActionForm>
    </>
  );
}
