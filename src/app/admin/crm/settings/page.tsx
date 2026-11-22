import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, PageHead } from "@/components/admin/fields";
import { getCrmSettings } from "@/lib/crm/config";
import { channelStatus, telegramStartLink } from "@/lib/crm/channels";
import { siteUrl } from "@/lib/seo";
import { connectWebhooks, importFromSite, runAutomationsNow, saveCrm } from "../actions";
import { crmSecret, getCrmState } from "@/lib/crm/setup";
import { greenApiAccount } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";

const Status = ({ on }: { on: boolean }) => <span className={`chip font-semibold ${on ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#eef0f3] text-[#4b5563]"}`}>{on ? "Միացված է" : "Միացված չէ"}</span>;
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-[12.5px] break-all">{children}</code>;

export default async function CrmSettings() {
  const cfg = await getCrmSettings();
  const state = await getCrmState();
  const on = channelStatus();
  const [wa, siteSt] = await Promise.all([greenApiAccount(), getSettings()]);
  const want = (siteSt.contacts.whatsapp || "").replace(/\D/g, "");
  const fmt = (d: string) => d.length === 11 && d.startsWith("374") ? `+374 ${d.slice(3, 5)} ${d.slice(5)}` : `+${d}`;
  const site = siteUrl();
  const tg = telegramStartLink("instagram", process.env.TELEGRAM_BOT_USERNAME || state.telegramUsername);
  const env = (k: string) => Boolean(process.env[k]);
  const channels: { name: string; on: boolean; vars: string[]; hook?: string; steps: React.ReactNode }[] = [
    {
      name: "WhatsApp (GREEN-API)", on: on.whatsapp && state.greenApi === "ok", vars: ["GREEN_API_ID_INSTANCE", "GREEN_API_TOKEN", "GREEN_API_ADMIN_PHONE"], hook: `${site}/api/crm/whatsapp`,
      steps: <>Ավելացրեք GREEN-API-ի <b>idInstance</b>-ը և <b>apiTokenInstance</b>-ը Vercel-ում, redeploy, ապա սեղմեք «Միացնել webhook-ները»։ Կայքն ինքը կկարգավորի GREEN-API-ն (մուտքային և հեռախոսից ուղարկված հաղորդագրություններ)։ Webhook token՝ <Code>{crmSecret("GREEN_API_WEBHOOK_TOKEN")}</Code></>,
    },
    {
      name: "Telegram բոտ", on: on.telegram && state.telegram === "ok", vars: ["TELEGRAM_BOT_TOKEN"], hook: `${site}/api/crm/telegram`,
      steps: <>Telegram-ում գրեք @BotFather-ին → /newbot → պատճենեք token-ը և ավելացրեք Vercel-ում՝ <Code>TELEGRAM_BOT_TOKEN</Code>, redeploy, ապա սեղմեք «Միացնել webhook-ները»։ {tg ? <>Instagram-ի bio-ում դրեք՝ <Code>{tg}</Code> (աղբյուրը կգրանցվի ավտոմատ)։</> : null}</>,
    },
    {
      name: "Instagram Direct և Facebook Messenger", on: on.instagram && env("META_APP_SECRET"), vars: ["META_PAGE_TOKEN", "META_APP_SECRET"], hook: `${site}/api/crm/meta`,
      steps: <>developers.facebook.com → Create App (Business) → ավելացրեք Messenger և Instagram → միացրեք Facebook էջը և Instagram Business հաշիվը → Webhooks՝ Callback URL՝ վերևի հասցեն, Verify token՝ <Code>{crmSecret("META_VERIFY_TOKEN")}</Code>, բաժանորդագրվեք «messages»-ին։ Page access token-ը դրեք <Code>META_PAGE_TOKEN</Code>-ում։ Իրական օգտատերերի համար պետք է անցնել Meta App Review (pages_messaging, instagram_manage_messages)։</>,
    },
    {
      name: "Էլ. փոստ (SMTP)", on: on.email, vars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"],
      steps: <>Gmail-ի դեպքում՝ App Password (տե՛ս README)։ Նույն կարգավորումն օգտագործում է ամբողջ կայքը։</>,
    },
    {
      name: "Արտաքին ձևեր (Zapier, Make, Lead Ads, Google Forms)", on: true, vars: [], hook: `${site}/api/crm/lead`,
      steps: <>POST JSON՝ <Code>{`{"name":"…","phone":"…","email":"…","source":"instagram","course":"ՖՎԾ-01","message":"…"}`}</Code>, header՝ <Code>x-crm-key: {crmSecret("CRM_API_KEY")}</Code>։ Facebook/Instagram Lead Ads-ի հայտերը կարող եք ուղարկել այստեղ Zapier-ի կամ Make-ի միջոցով։</>,
    },
  ];

  return (
    <>
      <PageHead title="Ավտոմատացում և ալիքներ" />
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Ավտոմատ գործողություններ">
          <ActionForm action={saveCrm} className="grid gap-3">
            <Check name="autoReply" label="Նոր լիդին անմիջապես ուղարկել ողջույնի հաղորդագրություն («welcome»)" defaultChecked={cfg.autoReply} />
            <label className="label">Առաջին կապի առաջադրանքի ժամկետը (րոպե)<input name="speedMinutes" type="number" min={5} defaultValue={cfg.speedMinutes} className="input" /></label>
            <Check name="followUps" label="Հետևողական հաղորդագրություններ լռող նոր լիդերին" defaultChecked={cfg.followUps} />
            <label className="label">Հետևողականի օրերը (օր.՝ 1, 3, 7)<input name="followUpDays" defaultValue={cfg.followUpDays.join(", ")} className="input" /></label>
            <Check name="reminders" label="Հիշեցում խորհրդատվությունից / փորձնական դասից 1 օր առաջ" defaultChecked={cfg.reminders} />
            <label className="label">Կորցրածներին կրկին գրել N օր հետո, երբ բաց խումբ կա (0՝ անջատել)<input name="reengageDays" type="number" min={0} defaultValue={cfg.reengageDays} className="input" /></label>
            <label className="label">Փակել որպես «Կորցրած» N օր պատասխան չլինելու դեպքում (0՝ անջատել)<input name="autoLoseDays" type="number" min={0} defaultValue={cfg.autoLoseDays} className="input" /></label>
            <Check name="reviewRequest" label="Դասընթացի ավարտից հետո խնդրել կարծիք և խորհուրդ ընկերներին" defaultChecked={cfg.reviewRequest} />
            <Check name="digest" label="Ամեն առավոտ ինձ ուղարկել օրվա պլանը (էլ. փոստ + WhatsApp)" defaultChecked={cfg.digest} />
            <label className="label">Օրական առավելագույն ավտոմատ հաղորդագրություններ<input name="dailyLimit" type="number" min={1} max={300} defaultValue={cfg.dailyLimit} className="input" /></label>
            <div><SubmitButton pendingText="Պահպանվում է…">Պահպանել</SubmitButton></div>
            <p className="m-0 text-[12.5px] text-muted">Ավտոմատացումը աշխատում է ամեն օր 10:30-ին (Երևանի ժամով)՝ <Code>/api/cron/crm</Code>։ Ողջույնը և ադմինի ծանուցումը գնում են անմիջապես։</p>
          </ActionForm>
        </AdminCard>

        <div className="flex flex-col gap-6">
          <AdminCard title="Կայքի տվյալներ և ձեռքով գործարկում">
            <div className="grid gap-4">
              <ActionForm action={importFromSite} className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex-1 text-[14px]">Ստեղծել լիդեր բոլոր գրանցվածների, հայտերի, «Կապ» նամակների և բաժանորդների համար (կրկնակի չի ստեղծում, ոչ մեկին հաղորդագրություն չի ուղարկում)։</span>
                <SubmitButton className="btn-soft min-h-11" pendingText="Համաժամեցվում է…">Ներմուծել</SubmitButton>
              </ActionForm>
              <ActionForm action={connectWebhooks} className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex-1 text-[14px]">Միացնել WhatsApp-ը և Telegram-ը այս կայքին (երբ բանալիներն ավելացված են Vercel-ում)։<br /><Check name="force" label="Փոխարինել GREEN-API-ի այլ webhook-ը, եթե կա" /></span>
                <SubmitButton className="btn-soft min-h-11" pendingText="Միացվում է…">Միացնել webhook-ները</SubmitButton>
              </ActionForm>
              <ActionForm action={runAutomationsNow} className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex-1 text-[14px]">Գործարկել օրվա ավտոմատացումը հիմա (հետևողական, հիշեցումներ, առաջադրանքներ, գնահատականներ)։</span>
                <SubmitButton className="btn-soft min-h-11" pendingText="Աշխատում է…">Գործարկել</SubmitButton>
              </ActionForm>
            </div>
          </AdminCard>

          <AdminCard title="Կապի ալիքներ">
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {channels.map((c) => (
                <li key={c.name} className="rounded-xl border border-line p-4 text-[14px]">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><b className="text-navy-900">{c.name}</b><Status on={c.on} /></div>
                  {c.name.startsWith("WhatsApp") && wa && (
                    <p className={`m-0 mb-2 rounded-lg px-3 py-2 text-[13.5px] ${wa.state === "authorized" && wa.phone && (!want || wa.phone === want) ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#fdf1e3] text-[#7a4a12]"}`}>
                      {wa.state === "authorized" && wa.phone
                        ? <>CRM-ի WhatsApp-ը աշխատում է <b>{fmt(wa.phone)}</b> համարով{want && wa.phone !== want ? <> — սա կայքի համարը (<b>{fmt(want)}</b>) չէ։ GREEN-API console → Logout, ապա սկանավորեք QR-ը {fmt(want)} համարի WhatsApp-ով։</> : " ✓"}</>
                        : <>GREEN-API-ին WhatsApp միացված չէ (կարգավիճակ՝ {wa.state})։ Console-ում սկանավորեք QR-ը{want ? <> {fmt(want)} համարի WhatsApp-ով</> : null}։</>}
                    </p>
                  )}
                  {c.hook && <p className="m-0 mb-2">Webhook՝ <Code>{c.hook}</Code></p>}
                  <p className="m-0 mb-2 text-[13px] text-[#3d4757]">{c.steps}</p>
                  {c.vars.length > 0 && <p className="m-0 text-[12.5px] text-muted">Vercel → Settings → Environment Variables՝ {c.vars.map((v) => <span key={v} className={`mr-1.5 inline-block ${env(v) ? "text-[#1f5f33]" : ""}`}><Code>{v}</Code>{env(v) ? " ✓" : ""}</span>)}</p>}
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
