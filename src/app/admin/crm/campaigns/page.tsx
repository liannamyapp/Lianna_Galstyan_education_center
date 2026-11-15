import { asc, desc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, PageHead, th, td } from "@/components/admin/fields";
import { CHANNELS, SOURCES, STAGES, channelHy, sourceHy, stageHy } from "@/lib/crm/constants";
import { channelStatus } from "@/lib/crm/channels";
import { ensureDefaultTemplates } from "@/lib/crm/leads";
import { sendCampaign } from "../actions";

export default async function Campaigns() {
  await ensureDefaultTemplates();
  const [templates, courses, history] = await Promise.all([
    db.select({ key: s.crmTemplates.key, name: s.crmTemplates.name }).from(s.crmTemplates).orderBy(asc(s.crmTemplates.createdAt)),
    db.select({ id: s.courses.id, code: s.courses.code, title: s.courses.title }).from(s.courses).orderBy(asc(s.courses.order)),
    db.select().from(s.crmCampaigns).orderBy(desc(s.crmCampaigns.createdAt)).limit(30),
  ]);
  const on = channelStatus();
  return (
    <>
      <PageHead title="Զանգվածային ուղարկում" />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <AdminCard title="Նոր ուղարկում ընտրված լիդերին">
          <ActionForm action={sendCampaign} className="grid gap-4 sm:grid-cols-2">
            <label className="label sm:col-span-2">Անվանում<input name="name" className="input" placeholder="օր.՝ Դեկտեմբերյան խմբի բացում" /></label>
            <label className="label">Ձևանմուշ *<select name="template" required className="input"><option value="">—</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></label>
            <label className="label">Ալիք<select name="channel" defaultValue="auto" className="input"><option value="auto">Ավտոմատ (յուրաքանչյուրի համար լավագույնը)</option>{CHANNELS.map((c) => <option key={c} value={c} disabled={!on[c]}>{channelHy[c]}{on[c] ? "" : " — միացված չէ"}</option>)}</select></label>
            <fieldset className="m-0 rounded-2xl border border-line p-4 sm:col-span-2"><legend className="px-1.5 text-[13.5px] font-semibold text-[#3d4757]">Փուլեր (ոչինչ չնշելու դեպքում՝ բոլորը)</legend>
              <div className="flex flex-wrap gap-x-5">{STAGES.map((x) => <Check key={x} name="stages" label={stageHy[x]} defaultChecked={x === "LOST"} />)}</div>
            </fieldset>
            <label className="label">Աղբյուր<select name="source" className="input"><option value="">Բոլորը</option>{SOURCES.map((x) => <option key={x} value={x}>{sourceHy[x]}</option>)}</select></label>
            <label className="label">Դասընթաց<select name="courseId" className="input"><option value="">Բոլորը</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {tr(c.title, "hy")}</option>)}</select></label>
            <label className="label">Պիտակ<input name="tag" className="input" /></label>
            <label className="label">Նվազագույն գնահատական<input name="minScore" type="number" min={0} max={100} className="input" /></label>
            <label className="label">Առավելագույնը (մինչև 150)<input name="limit" type="number" min={1} max={150} defaultValue={100} className="input" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <Check name="dry" label="Միայն հաշվել (չուղարկել)" defaultChecked />
              <SubmitButton pendingText="Ուղարկվում է… (կարող է տևել մինչև 1 րոպե)">Կատարել</SubmitButton>
            </div>
            <p className="m-0 text-[12.5px] text-muted sm:col-span-2">Ուղարկվում է միայն համաձայնություն տված և չհրաժարված լիդերին։ Նույն լիդը նույն ուղարկումը երկու անգամ չի ստանում։ WhatsApp-ի համար մի ուղարկեք շատ հաճախ, որ համարը չարգելափակվի. լավագույնը՝ շաբաթը մեկ անգամից ոչ ավել։ Instagram/Messenger-ով ուղարկվում է միայն վերջին 24 ժամում գրած մարդկանց (Meta-ի կանոն)։</p>
          </ActionForm>
        </AdminCard>
        <AdminCard title="Պատմություն">
          {history.length === 0 ? <p className="text-muted">Դեռ ուղարկումներ չեն եղել։</p> : (
            <div className="overflow-x-auto"><table className="w-full border-collapse">
              <thead><tr><th className={th}>Անվանում</th><th className={th}>Ալիք</th><th className={th}>Ուղարկված</th><th className={th}>Ամսաթիվ</th></tr></thead>
              <tbody>{history.map((c) => <tr key={c.id}><td className={td}>{c.name}</td><td className={td}>{channelHy[c.channel] ?? "Ավտոմատ"}</td><td className={td}>{c.sent}/{c.total}{c.failed ? <span className="text-muted"> · {c.failed} ձախողված</span> : null}</td><td className={`${td} text-muted`}>{dateShort(c.createdAt)}</td></tr>)}</tbody>
            </table></div>
          )}
        </AdminCard>
      </div>
    </>
  );
}
