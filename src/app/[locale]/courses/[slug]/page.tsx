import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDict, tr, trList, fmt, type Locale } from "@/lib/i18n";
import { getCourse, getCourses } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { money, date } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { JsonLd, pageMeta, siteUrl } from "@/lib/seo";

export const revalidate = 600;

export async function generateStaticParams() {
  const list = await getCourses();
  return list.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = await getCourse(slug);
  if (!c) return {};
  return pageMeta({ locale, path: `/courses/${slug}`, title: `${tr(c.title, locale)} (${c.code})`, description: tr(c.summary, locale), image: c.imageUrl ?? undefined });
}

export default async function CoursePage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const [c, st] = await Promise.all([getCourse(slug), getSettings()]);
  if (!c) notFound();
  const t = getDict(locale);
  const g = c.nextGroup;
  const maxH = Math.max(...c.modules.map((m) => m.hours), 1);
  const courseLd = {
    "@context": "https://schema.org", "@type": "Course", name: tr(c.title, locale), description: tr(c.summary, locale), courseCode: c.code,
    provider: { "@type": "EducationalOrganization", name: tr(st.site.name, locale), url: siteUrl() },
    inLanguage: ["hy", "ru", "en"], timeRequired: `PT${c.hours}H`,
    offers: [
      { "@type": "Offer", name: t.format.group, price: c.priceMonthly, priceCurrency: "AMD", category: "Paid", availability: "https://schema.org/InStock", url: `${siteUrl()}/${locale}/courses/${c.slug}` },
      { "@type": "Offer", name: t.format.individual, price: c.priceIndividual, priceCurrency: "AMD", category: "Paid", availability: "https://schema.org/InStock", url: `${siteUrl()}/${locale}/enroll/${c.slug}?format=individual` },
    ],
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", courseWorkload: `PT${c.hours}H`, ...(g ? { startDate: new Date(g.startDate).toISOString().slice(0, 10) } : {}), instructor: { "@type": "Person", name: tr(st.instructor.name, locale) } },
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: t.nav.home, item: `${siteUrl()}/${locale}` },
    { "@type": "ListItem", position: 2, name: t.nav.courses, item: `${siteUrl()}/${locale}/courses` },
    { "@type": "ListItem", position: 3, name: tr(c.title, locale) },
  ] };
  const outcomes = trList(c.outcomes, locale);
  return (
    <>
      <JsonLd data={courseLd} /><JsonLd data={crumbs} />
      <section className="bg-grid pb-16 text-white">
        <div className="container-x pt-9">
          <nav aria-label="Breadcrumb" className="text-[13px] text-[#b9c4d4]">
            <Link href={`/${locale}`} className="text-[#b9c4d4]">{t.nav.home}</Link> / <Link href={`/${locale}/courses`} className="text-[#b9c4d4]">{t.nav.courses}</Link> / <span aria-current="page">{c.code}</span>
          </nav>
          <div className="mt-7 flex flex-wrap items-start gap-12">
            <div className="min-w-0 flex-[1_1_560px]">
              <span className="rounded-full border border-gold-500/50 px-3 py-1 font-mono text-[13px] text-gold-300">{c.code}</span>
              <h1 className="mt-5 mb-4 font-serif text-[clamp(32px,4.4vw,54px)] leading-[1.15] font-bold">{tr(c.title, locale)}</h1>
              <p className="mb-7 max-w-[620px] text-[17.5px] text-[#c9d3e1]">{tr(c.summary, locale)}</p>
              <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0 text-[13.5px]">
                <li className="chip bg-white/10">{c.hours} {t.course.hours}</li>
                <li className="chip bg-white/10">{fmt(t.course.lessonsWeek, { n: c.lessonsPerWeek })}</li>
                <li className="chip bg-white/10">{t.course.online}</li>
                <li className="chip bg-white/10">{fmt(t.home.age, { n: c.minAge })}</li>
              </ul>
            </div>
            <aside className="card w-full max-w-[400px] min-w-0 flex-[0_1_380px] p-7 text-ink shadow-[0_30px_70px_rgba(0,0,0,.35)]">
              <p className="m-0 text-[13px] text-muted">{t.course.price}</p>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <a href="#format" className="rounded-2xl border-2 border-navy-800 bg-[#f3f6fa] p-3.5 no-underline">
                  <span className="block text-[12.5px] font-semibold text-navy-800">{t.format.group}</span>
                  <span className="block font-serif text-[22px] font-bold whitespace-nowrap text-navy-900">{money(c.priceMonthly, locale)}</span>
                  <span className="text-[12.5px] text-muted">{t.course.perMonth}</span>
                </a>
                <a href="#format" className="rounded-2xl border border-[#e3d3a8] bg-[#fbf7ec] p-3.5 no-underline">
                  <span className="block text-[12.5px] font-semibold text-gold-700">{t.format.individual}</span>
                  <span className="block font-serif text-[22px] font-bold whitespace-nowrap text-navy-900">{money(c.priceIndividual, locale)}</span>
                  <span className="text-[12.5px] text-muted">{t.course.perMonth}</span>
                </a>
              </div>
              {c.priceFull ? <p className="mt-3 mb-0 text-[13.5px] text-muted">{fmt(t.course.orFull, { price: money(c.priceFull, locale) })} · {t.format.group}</p> : null}
              <dl className="my-5 flex flex-col gap-2.5 border-t border-[#eee7d8] pt-4 text-[14px]">
                {g ? (
                  <>
                    <div className="flex justify-between gap-4"><dt className="text-muted">{t.course.start}</dt><dd className="m-0 font-semibold">{date(g.startDate, locale)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">{t.course.schedule}</dt><dd className="m-0 text-right font-semibold">{tr(g.schedule, locale)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">{t.course.freeSeats}</dt><dd className="m-0 font-semibold">{Math.max(0, g.seats - g.taken)} / {g.seats}</dd></div>
                  </>
                ) : <div><dt className="sr-only">{t.course.start}</dt><dd className="m-0 text-muted">{t.course.tbaGroup}</dd></div>}
              </dl>
              <Link href={`/${locale}/enroll/${c.slug}`} className="btn-navy w-full">{t.course.enrollPay}</Link>
              <p className="mt-3 mb-0 text-center text-[12.5px] text-muted">{t.course.trial} · Idram · ArCa · Visa · Mastercard</p>
            </aside>
          </div>
        </div>
      </section>

      <div className="container-x flex flex-wrap gap-11 pt-16">
        <div className="min-w-0 flex-[999_1_600px]">
          <p className="eyebrow">{t.course.programTitle}</p>
          <h2 className="h-section mt-2 mb-6">{fmt(t.course.modulesHours, { m: c.modules.length, h: c.hours })}</h2>
          <ol className="card m-0 list-none overflow-hidden p-0">
            {c.modules.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#eee7d8] px-5 py-4 last:border-0">
                <span className="w-9 font-mono text-[13px] text-gold-700">{m.code}</span>
                <span className="min-w-0 flex-1 font-semibold text-navy-900">{tr(m.title, locale)}</span>
                <span className="text-[13.5px] text-muted">{m.hours} {t.course.h}</span>
                <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-[#efe9dc] sm:block" aria-hidden="true"><span className="block h-1.5 bg-navy-800" style={{ width: `${Math.round((m.hours / maxH) * 100)}%` }} /></span>
              </li>
            ))}
          </ol>
          {c.theoryHours > 0 && <p className="mt-3 text-[14px] text-muted">{fmt(t.course.theoryPractice, { t: c.theoryHours, p: c.practiceHours })} · {t.course.fullProgramNote}</p>}

          {tr(c.description, locale) && <div className="prose-lg mt-10 whitespace-pre-line">{tr(c.description, locale)}</div>}

          {outcomes.length > 0 && (
            <>
              <p className="eyebrow mt-14">{t.course.outcomesEyebrow}</p>
              <h2 className="h-section mt-2 mb-6">{t.course.outcomesTitle}</h2>
              <ul className="m-0 grid list-none gap-3.5 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
                {outcomes.map((o) => <li key={o} className="card flex gap-3 p-5"><Icon name="check" className="mt-0.5 flex-none text-gold-700" strokeWidth={2.2} />{o}</li>)}
              </ul>
            </>
          )}

          <p id="format" className="eyebrow mt-14 scroll-mt-24">{t.format.title}</p>
          <h2 className="h-section mt-2 mb-2">{t.format.compareTitle}</h2>
          <p className="mb-6 text-muted">{t.format.compareText}</p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
            {([["group", c.priceMonthly, c.priceFull, t.format.groupPoints], ["individual", c.priceIndividual, c.priceIndividualFull, t.format.individualPoints]] as const).map(([f, m, full, pts]) => (
              <div key={f} className={`card flex flex-col p-7 ${f === "individual" ? "border-[#e3d3a8] bg-[#fffdf7]" : ""}`}>
                <p className={`m-0 text-[13px] font-semibold tracking-[0.12em] uppercase ${f === "individual" ? "text-gold-700" : "text-navy-800"}`}>{t.format[f]}</p>
                <p className="mt-2 mb-0 flex items-baseline gap-2"><span className="font-serif text-[30px] font-bold text-navy-900">{money(m, locale)}</span><span className="text-muted">{t.course.perMonth}</span></p>
                {full ? <p className="m-0 text-[13.5px] text-muted">{fmt(t.course.orFull, { price: money(full, locale) })}</p> : null}
                <ul className="my-5 flex list-none flex-col gap-2.5 p-0 text-[15px]">
                  {pts.map((x) => <li key={x} className="flex gap-2.5"><Icon name="check" size={18} className="mt-0.5 flex-none text-gold-700" strokeWidth={2.4} />{x}</li>)}
                </ul>
                <Link href={`/${locale}/enroll/${c.slug}${f === "individual" ? "?format=individual" : ""}`} className={`${f === "individual" ? "btn-gold" : "btn-navy"} mt-auto`}>{t.course.enroll}</Link>
              </div>
            ))}
          </div>

          <p id="certificate" className="eyebrow mt-14 scroll-mt-24">{t.course.certEyebrow}</p>
          <h2 className="h-section mt-2 mb-6">{t.course.certTitle}</h2>
          <div className="card flex flex-wrap items-center gap-8 p-7">
            <Image src={c.certificateUrl || "/images/certificate-sample.webp"} alt={t.course.certSample} width={300} height={424} sizes="(max-width: 640px) 100vw, 300px"
              className="h-auto w-full max-w-[300px] flex-none rounded-lg shadow-[0_14px_40px_rgba(15,36,64,.18)]" />
            <div className="min-w-0 flex-[1_1_280px]">
              <p className="mb-4 text-[#3d4757]">{t.course.certText}</p>
              <Link href={`/${locale}/verify`} className="btn-soft">{t.course.howVerify}</Link>
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <div className="card p-6">
            <p className="eyebrow">{t.course.instructor}</p>
            <div className="mt-3 flex items-center gap-3.5">
              <Image src={st.instructor.photoUrl} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
              <div><b className="text-navy-900">{tr(st.instructor.name, locale)}</b><div className="text-[13.5px] text-muted">{tr(st.instructor.role, locale)}</div></div>
            </div>
          </div>
          {tr(c.requirements, locale) && <div className="card p-6"><p className="eyebrow">{t.course.requirements}</p><p className="mt-2.5 mb-0 text-[14.5px] text-[#3d4757]">{tr(c.requirements, locale)}</p></div>}
          <div className="card p-6">
            <p className="eyebrow">{t.course.documents}</p>
            <ul className="mt-2.5 mb-0 flex list-none flex-col gap-2 p-0 text-[14.5px]">
              <li><a href="#certificate">{t.course.certSample}</a></li>
              <li><Link href={`/${locale}/p/contract`}>{t.footer.contract}</Link></li>
              <li><Link href={`/${locale}/p/refund`}>{t.footer.refund}</Link></li>
            </ul>
          </div>
          {(c.endorsement || tr(st.legal.endorsement, locale)) && <div className="rounded-[18px] border border-[#e3d3a8] bg-[#fbf7ec] p-5 text-[14px] text-[#5b4a22]">{c.endorsement || tr(st.legal.endorsement, locale)}</div>}
        </aside>
      </div>
    </>
  );
}
