import Link from "next/link";
import { getDict, tr, fmt, type Locale } from "@/lib/i18n";
import { money, date } from "@/lib/format";
import type { CourseWithMeta } from "@/lib/data";

export function CourseCard({ c, locale }: { c: CourseWithMeta; locale: Locale }) {
  const t = getDict(locale);
  return (
    <article className="card group relative flex flex-col gap-5 p-7 transition-shadow hover:shadow-[0_24px_60px_rgba(15,36,64,.10)] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[#e3d3a8] px-3 py-1 font-mono text-[13px] text-gold-700">{c.code}</span>
        <span className="text-[13px] text-muted">{tr(c.level, locale)}</span>
      </div>
      <div>
        <h3 className="font-serif text-[26px] leading-snug font-bold text-navy-900">
          <Link href={`/${locale}/courses/${c.slug}`} className="text-inherit no-underline after:absolute after:inset-0 after:rounded-[18px]">{tr(c.title, locale)}</Link>
        </h3>
        <p className="mt-2 text-muted">{tr(c.summary, locale)}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2.5 text-[13.5px]">
        {[[c.hours, t.course.hours], [c.weeks, t.course.weeks], [c.modules.length, t.course.modules]].map(([v, l]) => (
          <div key={String(l)} className="rounded-xl bg-ivory px-3.5 py-3"><dt className="sr-only">{l}</dt><dd><b className="block text-[18px] text-navy-800">{v}</b>{l}</dd></div>
        ))}
      </dl>
      {c.nextGroup && <p className="text-[13.5px] text-navy-800">{fmt(t.home.nextGroup, { date: date(c.nextGroup.startDate, locale) })}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-[#eee7d8] pt-5">
        <div>
          <p className="m-0"><span className="font-serif text-[26px] font-bold text-navy-900">{money(c.priceMonthly, locale)}</span> <span className="text-muted">{t.course.perMonth}</span></p>
          <p className="m-0 text-[13px] text-muted">{t.format.individual}{locale === "hy" ? "՝ " : ": "}{money(c.priceIndividual, locale)}</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2.5">
          <Link href={`/${locale}/courses/${c.slug}`} className="btn-soft">{t.course.details}</Link>
          <Link href={`/${locale}/enroll/${c.slug}`} className="btn-navy">{t.course.enroll}</Link>
        </div>
      </div>
    </article>
  );
}
