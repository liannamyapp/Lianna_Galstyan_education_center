import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, tr, fmt, type Locale } from "@/lib/i18n";
import { getCourse } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { ameriaEnabled, idramEnabled, testPaymentsAllowed } from "@/lib/payments";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { pageMeta } from "@/lib/seo";
import { enrollAction } from "../../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  return pageMeta({ locale, path: `/enroll/${slug}`, title: getDict(locale).enroll.title, description: "", noindex: true });
}

const radio = "flex cursor-pointer gap-3 rounded-2xl border border-[#d9d0bd] p-4 has-[:checked]:border-2 has-[:checked]:border-navy-800 has-[:checked]:bg-[#f3f6fa] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-500";

export default async function Enroll({ params, searchParams }: { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<{ format?: string }> }) {
  const { locale, slug } = await params;
  const indiv = (await searchParams).format === "individual";
  const t = getDict(locale);
  const [c, user, st] = await Promise.all([getCourse(slug), getCurrentUser(), getSettings()]);
  if (!c) notFound();
  const card = st.payments.card && (ameriaEnabled() || testPaymentsAllowed());
  const idram = st.payments.idram && (idramEnabled() || testPaymentsAllowed());
  const steps = [t.enroll.stepCourse, t.enroll.stepData, t.enroll.stepDone];

  return (
    <div className="container-x max-w-[1160px] pt-11">
      <ol aria-label="Steps" className="m-0 mb-9 flex list-none flex-wrap items-center gap-3 p-0 text-[14px]">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2.5 ${i < 2 ? "font-semibold text-navy-800" : "text-muted"}`} aria-current={i === 1 ? "step" : undefined}>
            <span className={`flex size-7 items-center justify-center rounded-full text-[13px] ${i < 2 ? "bg-navy-800 text-white" : "border-[1.5px] border-[#c8c2b4]"}`}>{i === 0 ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>{s}
            {i < 2 && <span aria-hidden="true" className="ml-1 h-px w-8 bg-[#cdbf9f]" />}
          </li>
        ))}
      </ol>

      {!user ? (
        <div className="card max-w-[560px] p-8">
          <h1 className="font-serif text-[28px] font-bold text-navy-900">{t.enroll.title}</h1>
          <p className="mt-2 text-muted">{t.enroll.loginFirst}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/${locale}/register?next=/${locale}/enroll/${slug}`} className="btn-navy">{t.auth.registerBtn}</Link>
            <Link href={`/${locale}/login?next=/${locale}/enroll/${slug}`} className="btn-soft">{t.auth.loginBtn}</Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-8">
          <ActionForm action={enrollAction} successReplace className="group/enroll card flex min-w-0 flex-[999_1_560px] flex-col gap-7 p-7 sm:p-9">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="courseId" value={c.id} />
            <input type="hidden" name="slug" value={c.slug} />
            <div><h1 className="font-serif text-[30px] font-bold text-navy-900">{t.enroll.title}</h1><p className="mt-1 text-[14.5px] text-muted">{t.enroll.subtitle}</p></div>

            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-3 font-bold text-navy-900">{t.format.title}</legend>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
                <label className={radio}><input id="fmt-grp" type="radio" name="format" value="group" defaultChecked={!indiv} className="mt-1 accent-navy-800" /><span><b className="text-navy-900">{t.format.group}</b> · <span className="text-navy-800">{money(c.priceMonthly, locale)} {t.course.perMonth}</span><br /><span className="text-[13.5px] text-muted">{t.format.groupNote}</span></span></label>
                <label className={radio}><input id="fmt-ind" type="radio" name="format" value="individual" defaultChecked={indiv} className="mt-1 accent-navy-800" /><span><b className="text-navy-900">{t.format.individual}</b> · <span className="text-navy-800">{money(c.priceIndividual, locale)} {t.course.perMonth}</span><br /><span className="text-[13.5px] text-muted">{t.format.individualNote}</span></span></label>
              </div>
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
              <legend className="mb-3 font-bold text-navy-900">{t.enroll.personal}</legend>
              <div className="flex flex-wrap gap-3.5">
                <label className="label flex-[1_1_240px]">{t.auth.name}<input name="name" required minLength={2} defaultValue={user.name} autoComplete="name" className="input" /></label>
                <label className="label flex-[1_1_240px]">{t.auth.phone}<input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" placeholder="+374" className="input" /></label>
              </div>
              <p className="m-0 hidden rounded-xl bg-ivory px-4 py-3 text-[14px] text-muted group-has-[#fmt-ind:checked]/enroll:block">{t.format.individualSchedule}</p>
              <label className="label group-has-[#fmt-ind:checked]/enroll:hidden">{t.enroll.group}
                <select name="groupId" className="input">
                  {c.groups.length ? c.groups.map((g) => <option key={g.id} value={g.id}>{date(g.startDate, locale)} · {tr(g.schedule, locale)}</option>) : <option value="">{t.enroll.noGroup}</option>}
                </select>
              </label>
              <label className="label">{t.enroll.note}<textarea name="note" rows={2} maxLength={1000} className="input py-3" /></label>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-3 font-bold text-navy-900">{t.enroll.planTitle}</legend>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
                <label className={radio}><input type="radio" name="plan" value="monthly" defaultChecked className="mt-1 accent-navy-800" /><span><b className="text-navy-900">{t.enroll.monthly}</b><br />
                  <span className="text-[14px] text-muted group-has-[#fmt-ind:checked]/enroll:hidden">{fmt(t.enroll.monthlyNote, { price: money(c.priceMonthly, locale) })} × {c.months}</span>
                  <span className="hidden text-[14px] text-muted group-has-[#fmt-ind:checked]/enroll:inline">{fmt(t.enroll.monthlyNote, { price: money(c.priceIndividual, locale) })} × {c.months}</span></span></label>
                {c.priceFull ? <label className={`${radio} ${c.priceIndividualFull ? "" : "group-has-[#fmt-ind:checked]/enroll:hidden"}`}><input type="radio" name="plan" value="full" className="mt-1 accent-navy-800" /><span><b className="text-navy-900">{t.enroll.full}</b><br />
                  <span className="text-[14px] text-muted group-has-[#fmt-ind:checked]/enroll:hidden">{fmt(t.enroll.fullNote, { price: money(c.priceFull, locale) })}</span>
                  {c.priceIndividualFull ? <span className="hidden text-[14px] text-muted group-has-[#fmt-ind:checked]/enroll:inline">{fmt(t.enroll.fullNote, { price: money(c.priceIndividualFull, locale) })}</span> : null}</span></label> : null}
              </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-3 font-bold text-navy-900">{t.enroll.methodTitle}</legend>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
                {card && <label className={`${radio} items-center`}><input type="radio" name="method" value="card" defaultChecked className="accent-navy-800" /><Icon name="card" className="text-navy-800" /><span><b className="text-navy-900">{t.enroll.card}</b><br /><span className="text-[12.5px] text-muted">{t.enroll.cardBrands}</span></span></label>}
                {idram && <label className={`${radio} items-center`}><input type="radio" name="method" value="idram" defaultChecked={!card} className="accent-navy-800" /><Icon name="wallet" className="text-navy-800" /><span><b className="text-navy-900">{t.enroll.idram}</b><br /><span className="text-[12.5px] text-muted">{t.enroll.idramNote}</span></span></label>}
                <label className={`${radio} items-center`}><input type="radio" name="method" value="none" defaultChecked={!card && !idram} className="accent-navy-800" /><Icon name="send" className="text-navy-800" /><span><b className="text-navy-900">{t.enroll.applyOnly}</b></span></label>
              </div>
              <p className="mt-3 mb-0 text-[13px] text-muted">{card || idram ? t.enroll.secureNote : t.enroll.noMethods}</p>
            </fieldset>

            <p className="m-0 rounded-xl border border-[#eadfc8] bg-[#fbf8f1] px-4 py-3.5 text-[14.5px] text-[#3d4757]">
              {t.contract.enrollNext} <Link href={`/${locale}/p/contract`} target="_blank">{t.contract.sampleLink}</Link> · <Link href={`/${locale}/p/refund`} target="_blank">{t.contract.refundLink}</Link>
            </p>
            <SubmitButton className="btn-navy min-h-13 self-start px-8" pendingText={t.common.sending}>{t.contract.continue}</SubmitButton>
          </ActionForm>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <div className="card p-7">
              <p className="eyebrow">{t.enroll.order}</p>
              <div className="my-4 flex items-center gap-3.5">
                <span className="flex size-13 flex-none items-center justify-center rounded-xl bg-navy-800 font-mono text-[11px] text-gold-300">{c.code.split("-")[0]}</span>
                <div><b className="text-navy-900">{tr(c.title, locale)}</b><div className="text-[13px] text-muted">{c.hours} {t.course.hours} · {c.weeks} {t.course.weeks}</div></div>
              </div>
              <dl className="m-0 flex flex-col gap-2 border-t border-[#eee7d8] pt-4 text-[14px]">
                <div className="flex justify-between gap-3"><dt className="text-muted">{t.format.group} · {t.enroll.monthly}</dt><dd className="m-0 whitespace-nowrap">{money(c.priceMonthly, locale)}</dd></div>
                {c.priceFull ? <div className="flex justify-between gap-3"><dt className="text-muted">{t.format.group} · {t.enroll.full}</dt><dd className="m-0 whitespace-nowrap">{money(c.priceFull, locale)}</dd></div> : null}
                <div className="flex justify-between gap-3"><dt className="text-muted">{t.format.individual} · {t.enroll.monthly}</dt><dd className="m-0 whitespace-nowrap">{money(c.priceIndividual, locale)}</dd></div>
                {c.priceIndividualFull ? <div className="flex justify-between gap-3"><dt className="text-muted">{t.format.individual} · {t.enroll.full}</dt><dd className="m-0 whitespace-nowrap">{money(c.priceIndividualFull, locale)}</dd></div> : null}
              </dl>
            </div>
            <div className="flex gap-3 rounded-[18px] border border-[#e3d3a8] bg-[#fbf7ec] p-5 text-[14px] text-[#5b4a22]"><Icon name="shield" className="mt-0.5 flex-none" />{t.enroll.trialNote}</div>
            <p className="px-1.5 text-[13px] text-muted">{t.enroll.receiptNote}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
