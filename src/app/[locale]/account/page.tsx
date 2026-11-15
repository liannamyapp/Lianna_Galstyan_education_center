import type { Metadata } from "next";
import Link from "next/link";
import { ValueButton } from "@/components/ValueButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDict, tr, fmt, type Locale } from "@/lib/i18n";
import { money, date, dateShort, initials } from "@/lib/format";
import { billing, type Billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Icon } from "@/components/Icon";
import { emailChangeAction, logoutAction, payNextAction, profileAction, reviewAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

const tone: Record<string, string> = { NEW: "bg-[#e6eef8] text-navy-800", INTERVIEW: "bg-[#fbf2dd] text-[#7a5a12]", APPROVED: "bg-[#e6eef8] text-navy-800", PAID: "bg-[#e3f1e6] text-[#1f5f33]", REJECTED: "bg-[#fbefeb] text-[#8a2f1d]", CANCELLED: "bg-[#eef0f3] text-[#4b5563]", PENDING: "bg-[#fbf2dd] text-[#7a5a12]", FAILED: "bg-[#fbefeb] text-[#8a2f1d]", REFUNDED: "bg-[#eef0f3] text-[#4b5563]" };

export default async function Account({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDict(locale);
  const user = await requireUser(locale);
  const apps = await db.query.applications.findMany({ where: eq(s.applications.userId, user.id), orderBy: [desc(s.applications.createdAt)], with: { course: true, group: true } });
  const st = await getSettings();
  const allPays = await db.select().from(s.payments).where(eq(s.payments.userId, user.id));
  const bills = new Map<string, Billing>(apps.map((a) => [a.id, billing(a, a.course, a.group?.startDate, allPays.filter((p) => p.applicationId === a.id), st.payments)]));
  const pays = await db.select().from(s.payments).where(and(eq(s.payments.userId, user.id), inArray(s.payments.status, ["PAID", "PENDING", "FAILED", "REFUNDED"]))).orderBy(desc(s.payments.createdAt)).limit(50);
  const certs = await db.query.certificates.findMany({ where: eq(s.certificates.userId, user.id), with: { course: true } });
  const myReviews = await db.select().from(s.reviews).where(eq(s.reviews.userId, user.id)).orderBy(desc(s.reviews.createdAt)).limit(5);
  const lessonsTotal = (c: { weeks: number; lessonsPerWeek: number }) => c.weeks * c.lessonsPerWeek;
  const nav = [["overview", t.account.dashboard, "chart"], ["payments", t.account.payments, "card"], ["documents", t.account.documents, "file"], ["review", t.account.myReview, "star"], ["profile", t.account.profile, "users"]];

  return (
    <div className="container-x flex flex-wrap items-start gap-7 pt-9">
      <LiveRefresh poll={myReviews.some((r) => r.status === "PENDING") || pays.some((p) => p.status === "PENDING" && Date.now() - new Date(p.createdAt).getTime() < 3_600_000)} />
      <aside className="card w-full p-4 lg:sticky lg:top-24 lg:w-[250px] lg:flex-none">
        <div className="mb-2.5 flex items-center gap-3 border-b border-[#eee7d8] px-2 pt-2 pb-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-sand font-bold text-navy-800">{initials(user.name)}</span>
          <div className="min-w-0"><b className="block truncate text-[15px] text-navy-900">{user.name}</b><span className="block truncate text-[12.5px] text-muted">{user.email}</span></div>
        </div>
        <nav aria-label={t.nav.account} className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-col">
          {nav.map(([id, label, icon]) => <a key={id} href={`#${id}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2 text-[13.5px] text-[#3d4757] sm:gap-2.5 sm:px-3 sm:text-[14px] no-underline hover:bg-ivory lg:px-3.5 lg:text-[14.5px]"><Icon name={icon} size={18} className="flex-none" /><span className="min-w-0 leading-tight break-words">{label}</span></a>)}
        </nav>
        <form action={logoutAction} className="mt-2 border-t border-[#eee7d8] pt-2"><input type="hidden" name="locale" value={locale} /><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-[14px] text-[#8a5a2b] hover:bg-ivory"><Icon name="logout" size={18} />{t.nav.logout}</button></form>
      </aside>

      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
        <section id="overview">
          <h1 className="font-serif text-[clamp(26px,7vw,32px)] font-bold break-words text-navy-900">{fmt(t.account.welcome, { name: user.name.split(" ")[0] })}</h1>
          {apps.length === 0 ? (
            <div className="card mt-5 p-8"><p className="text-muted">{t.account.noCourses}</p><Link href={`/${locale}/courses`} className="btn-navy mt-3">{t.account.browseCourses}</Link></div>
          ) : (
            <>
              {apps.map((a) => {
                const b = bills.get(a.id)!;
                if (a.status !== "PAID" || !b.next || !["soon", "due", "overdue"].includes(b.state)) return null;
                const vars = { date: date(b.next.due, locale), amount: money(b.next.amount, locale), n: Math.abs(b.daysLeft ?? 0) };
                const text = b.state === "soon" ? fmt(t.billing.soonBanner, vars) : b.state === "overdue" ? fmt(t.billing.lockedBanner, vars) : (b.daysLeft ?? 0) === 0 ? fmt(t.billing.dueBanner, vars) : fmt(t.billing.dueLateBanner, vars);
                const cls = b.state === "soon" ? "border-[#e3d3a8] bg-[#fbf7ec] text-[#5b4a22]" : "border-[#f0cfc6] bg-[#fbefeb] text-[#7a2a1a]";
                return (
                  <div key={`b-${a.id}`} role={b.state === "soon" ? "status" : "alert"} className={`mt-5 flex flex-wrap items-center gap-4 rounded-[18px] border p-5 ${cls}`}>
                    <Icon name={b.state === "overdue" ? "lock" : "calendar"} className="flex-none" />
                    <p className="m-0 min-w-0 flex-[1_1_260px] text-[15px]"><b>{a.course.code}</b> · {text}</p>
                    <form action={payNextAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="applicationId" value={a.id} />
                      <ValueButton name="method" value="card" className="btn-navy min-h-11">{t.account.payNow}</ValueButton>
                      <ValueButton name="method" value="idram" className="btn-soft min-h-11">Idram</ValueButton>
                    </form>
                  </div>
                );
              })}
              {apps.map((a) => {
            const b = bills.get(a.id)!;
            const total = lessonsTotal(a.course);
            const pct = Math.min(100, Math.round((a.lessonsDone / total) * 100));
            const active = a.status === "PAID";
            const open = active && !b.locked;
            const meeting = a.meetingUrl || a.group?.meetingUrl;
            const individual = a.format === "individual";
            return (
              <div key={a.id} className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
                <div className={`card p-7 ${active ? "border-navy-900 bg-navy-900 text-white sm:col-span-2" : ""}`}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div><p className={`m-0 text-[12.5px] tracking-[0.14em] uppercase ${active ? "text-gold-300" : "text-gold-700"}`}>{t.account.currentCourse} · {individual ? t.format.individual : t.format.group}</p><h2 className="mt-1.5 font-serif text-[23px] font-bold">{tr(a.course.title, locale)}</h2></div>
                    <span className={`chip h-fit font-semibold ${tone[a.status]}`}>{t.account.status[a.status]}</span>
                  </div>
                  {active && (
                    <>
                      <div className="mt-5 mb-2 flex justify-between text-[13.5px] text-[#c9d3e1]"><span>{fmt(t.account.progress, { done: a.lessonsDone, total })}</span><span>{pct}%</span></div>
                      <div className="h-2 rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.account.progress}><div className="h-2 rounded-full bg-gold-500" style={{ width: `${pct}%` }} /></div>
                      <p className="mt-3 text-[13.5px] text-[#c9d3e1]">{a.group ? `${date(a.group.startDate, locale)} · ${tr(a.group.schedule, locale)}` : individual ? (a.startDate ? `${date(a.startDate, locale)} · ${t.format.individualSchedule}` : t.format.individualSchedule) : t.account.nextLesson}</p>
                      {open ? (
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          {meeting && <a href={meeting} target="_blank" rel="noopener noreferrer" className="btn-gold min-h-11">{t.account.joinLesson}</a>}
                          <Link href={`/${locale}/account/lessons/${a.id}`} className="btn-ghost min-h-11"><Icon name="play" size={18} />{t.lessons.open}</Link>
                          {a.group?.recordingsUrl && <a href={a.group.recordingsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-11">{t.account.recordings}</a>}
                        </div>
                      ) : <p className="mt-4 mb-0 flex items-center gap-2 text-[14px] text-[#f3c9bd]"><Icon name="lock" size={18} />{t.lessons.locked}</p>}
                    </>
                  )}
                </div>
                {(active || a.status === "APPROVED") && (
                  <div className="card flex flex-col gap-2 p-5 sm:p-7">
                    <p className="eyebrow">{t.billing.schedule}</p>
                    {b.next ? (
                      <>
                        <p className="m-0 font-serif text-[28px] font-bold text-navy-900">{money(b.next.amount, locale)}</p>
                        <p className="m-0 text-[14px] text-muted">
                          {b.next.due ? fmt(t.billing.nextDue, { date: date(b.next.due, locale) }) : t.account.nextPayment}
                          {b.daysLeft !== null && <> · <b className={b.state === "upcoming" ? "text-navy-800" : b.state === "soon" ? "text-[#7a5a12]" : "text-[#8a2f1d]"}>{b.daysLeft > 0 ? fmt(t.billing.daysLeft, { n: b.daysLeft }) : b.daysLeft === 0 ? t.billing.today : fmt(t.billing.overdueDays, { n: -b.daysLeft })}</b></>}
                        </p>
                        <form action={payNextAction} className="mt-3 flex flex-col gap-2">
                          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="applicationId" value={a.id} />
                          <ValueButton name="method" value="card" className="btn-navy min-h-11">{t.account.payNow} · {t.enroll.card}</ValueButton>
                          <ValueButton name="method" value="idram" className="btn-soft min-h-11">Idram</ValueButton>
                        </form>
                      </>
                    ) : <p className="m-0 flex items-center gap-2 font-semibold text-[#1f5f33]"><Icon name="check" size={18} strokeWidth={2.6} />{t.billing.done}</p>}
                    {b.plan === "monthly" && b.paidCount > 0 && (
                      <ol className="mt-3 mb-0 flex list-none flex-col gap-1.5 border-t border-[#eee7d8] p-0 pt-3 text-[13.5px]">
                        {b.instalments.map((x) => (
                          <li key={x.index} className="flex items-center justify-between gap-3">
                            <span className={`whitespace-nowrap ${x.paid ? "text-[#1f5f33]" : "text-[#3d4757]"}`}>{x.paid ? "✓ " : ""}{fmt(t.billing.instalment, { i: x.index + 1, n: b.months })}</span>
                            <span className="whitespace-nowrap text-right text-muted">{x.paid ? fmt(t.billing.paidOn, { date: dateShort(x.paidAt) }) : x.due ? dateShort(x.due) : t.billing.upcoming}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {b.paidTotal > 0 && <p className="mt-2 mb-0 text-[13px] text-muted">{fmt(t.billing.total, { amount: money(b.paidTotal, locale) })}</p>}
                  </div>
                )}
              </div>
            );
          })}
            </>
          )}
        </section>

        <section id="payments" className="card p-5 sm:p-7">
          <h2 className="mb-3 text-[18px] font-semibold text-navy-900">{t.account.payments}</h2>
          {pays.length === 0 ? <p className="text-muted">{t.account.noPayments}</p> : (
            <>
              <ul className="m-0 flex list-none flex-col p-0 sm:hidden">{pays.map((p) => (
                <li key={p.id} className="border-t border-[#eee7d8] py-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-3"><b className="text-[15px] text-navy-900">{money(p.amount, locale)}</b><span className={`chip font-semibold ${tone[p.status]}`}>{t.account.payStatus[p.status]}</span></div>
                  <p className="mt-1 mb-0 text-[13.5px] text-muted">{dateShort(p.paidAt ?? p.createdAt)} · {p.description}</p>
                </li>
              ))}</ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full border-collapse text-[14.5px]">
                  <thead><tr className="text-left text-[13px] text-muted"><th className="py-2 pr-3 font-semibold">{t.account.date}</th><th className="py-2 pr-3 font-semibold">{t.account.description}</th><th className="py-2 pr-3 font-semibold">{t.account.amount}</th><th className="py-2 font-semibold">{t.account.statusCol}</th></tr></thead>
                  <tbody>{pays.map((p) => (
                    <tr key={p.id} className="border-t border-[#eee7d8]"><td className="py-3 pr-3 whitespace-nowrap">{dateShort(p.paidAt ?? p.createdAt)}</td><td className="py-3 pr-3">{p.description}</td><td className="py-3 pr-3 whitespace-nowrap">{money(p.amount, locale)}</td><td className="py-3"><span className={`chip font-semibold ${tone[p.status]}`}>{t.account.payStatus[p.status]}</span></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section id="documents" className="card p-5 sm:p-7">
          <h2 className="mb-2 text-[18px] font-semibold text-navy-900">{t.account.documents}</h2>
          <ul className="m-0 list-none p-0">
            {apps.filter((a) => a.contractNo).map((a) => (
              <li key={a.id} className="flex items-center gap-3.5 border-b border-[#eee7d8] py-3.5 last:border-0">
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-sand text-[11px] font-bold text-[#8a5a2b]">PDF</span>
                <span className="min-w-0 flex-1"><b className="text-[14.5px] text-navy-900">{fmt(t.account.contract, { no: a.contractNo! })}</b><br /><span className="text-[13px] text-muted">{a.course.code} · {tr(a.course.title, locale)}</span></span>
                <Link href={`/${locale}/account/contract/${a.id}`} className="text-[14px] font-semibold">{t.account.view}</Link>
              </li>
            ))}
            {certs.map((c) => (
              <li key={c.id} className="flex items-center gap-3.5 border-b border-[#eee7d8] py-3.5 last:border-0">
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-[#e3f1e6] text-[#1f5f33]"><Icon name="shield" size={18} /></span>
                <span className="min-w-0 flex-1"><b className="text-[14.5px] text-navy-900">{fmt(t.account.certificate, { no: c.number })}</b><br /><span className="text-[13px] text-muted">{tr(c.course.title, locale)}</span></span>
                {c.fileUrl ? <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold">{t.account.download}</a> : <Link href={`/${locale}/verify?n=${encodeURIComponent(c.number)}`} className="text-[14px] font-semibold">{t.account.view}</Link>}
              </li>
            ))}
            {certs.length === 0 && (
              <li className="flex items-center gap-3.5 py-3.5"><span className="flex size-10 flex-none items-center justify-center rounded-xl bg-[#eef1f5] text-[#7b8798]"><Icon name="lock" size={18} /></span><span className="text-[14px] text-muted">{t.account.certLocked}</span></li>
            )}
          </ul>
        </section>

        <section id="review" className="card p-5 sm:p-7">
          <h2 className="mb-1 text-[18px] font-semibold text-navy-900">{t.account.myReview}</h2>
          <p className="mb-4 text-[14px] text-muted">{t.account.reviewHint}</p>
          {myReviews.length > 0 && (
            <ul className="mb-5 flex list-none flex-col gap-2 p-0">{myReviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ivory px-4 py-3 text-[14px]"><span className="min-w-0 basis-full text-gold-700 sm:basis-auto">{"★".repeat(r.rating)}</span><span className="min-w-0 flex-1 basis-[180px] text-ink [overflow-wrap:anywhere] line-clamp-2">{r.text}</span><span className={`chip flex-none font-semibold ${r.status === "APPROVED" ? tone.PAID : r.status === "REJECTED" ? tone.REJECTED : tone.PENDING}`}>{t.account.reviewStatus[r.status]}</span>{r.reply && r.status === "APPROVED" && <p className="m-0 basis-full border-l-2 border-gold-500 pl-3 text-[13.5px] text-muted [overflow-wrap:anywhere]"><b className="text-navy-900">{t.account.replyFrom}</b> {r.reply}</p>}</li>
            ))}</ul>
          )}
          <ActionForm action={reviewAction} resetOnSuccess className="flex flex-col gap-3.5">
            <input type="hidden" name="locale" value={locale} />
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-[13.5px] font-semibold text-[#3d4757]">{t.account.rating}</legend>
              <div className="flex flex-row-reverse justify-end gap-1">
                {[5, 4, 3, 2, 1].map((n) => (
                  <label key={n} className="cursor-pointer text-[30px] leading-none text-[#d9d0bd] has-[:checked]:text-gold-500 [label:has(:checked)~&]:text-gold-500 hover:text-gold-400 [&:hover~label]:text-gold-400 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-500">
                    <input type="radio" name="rating" value={n} defaultChecked={n === 5} className="sr-only" /><span aria-hidden="true">★</span><span className="sr-only">{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {apps.length > 0 && (
              <label className="label">{t.account.course}<select name="courseId" className="input">{apps.map((a) => <option key={a.id} value={a.courseId}>{a.course.code} · {tr(a.course.title, locale)}</option>)}</select></label>
            )}
            <label className="label"><span className="sr-only">{t.account.myReview}</span><textarea name="text" required minLength={10} maxLength={2000} rows={4} placeholder={t.account.reviewPlaceholder} className="input py-3" /></label>
            <SubmitButton className="btn-navy self-end" pendingText={t.common.sending}>{t.account.send}</SubmitButton>
          </ActionForm>
        </section>

        <section id="profile" className="card p-5 sm:p-7">
          <h2 className="mb-4 text-[18px] font-semibold text-navy-900">{t.account.profile}</h2>
          <ActionForm action={profileAction} className="flex flex-col gap-4">
            <input type="hidden" name="locale" value={locale} />
            <div className="flex flex-wrap gap-4">
              <label className="label flex-[1_1_240px]">{t.auth.name}<input name="name" required defaultValue={user.name} autoComplete="name" className="input" /></label>
              <label className="label flex-[1_1_240px]">{t.auth.phone}<input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" className="input" /></label>
            </div>
            <label className="label">{t.account.newPassword}<input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="••••••••" className="input" /><span className="font-normal text-muted">{t.account.newPasswordHint}</span></label>
            <SubmitButton className="btn-navy self-start" pendingText={t.common.sending}>{t.account.save}</SubmitButton>
          </ActionForm>
          <div className="mt-8 border-t border-[#eee7d8] pt-6">
            <h3 className="mb-1 text-[16px] font-semibold text-navy-900">{t.account.loginEmail}</h3>
            <p className="mt-0 mb-4 text-[14px] text-muted">{t.account.currentEmail}: <b className="text-ink">{user.email}</b></p>
            <ActionForm action={emailChangeAction} resetOnSuccess className="flex flex-col gap-4">
              <input type="hidden" name="locale" value={locale} />
              <div className="flex flex-wrap gap-4">
                <label className="label flex-[1_1_240px]">{t.account.newEmail}<input name="email" type="email" required autoComplete="email" className="input" /></label>
                <label className="label flex-[1_1_240px]">{t.account.currentPassword}<input name="currentPassword" type="password" required autoComplete="current-password" className="input" /></label>
              </div>
              <p className="m-0 text-[13px] text-muted">{t.account.emailChangeHint}</p>
              <SubmitButton className="btn-soft self-start" pendingText={t.common.sending}>{t.account.changeEmail}</SubmitButton>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}
