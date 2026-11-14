import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getDict, tr, fmt, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getApprovedReviews, getCourses, getDirections, getFaqs, getPosts, getReviewStats } from "@/lib/data";
import { date, shortName } from "@/lib/format";
import { CourseCard } from "@/components/CourseCard";
import { Icon } from "@/components/Icon";
import { Stars } from "@/components/Stars";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { JsonLd, pageMeta, siteUrl } from "@/lib/seo";
import { subscribeAction } from "./actions";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const st = await getSettings();
  return { ...pageMeta({ locale, path: "/", title: `${tr(st.site.name, locale)} — ${tr(st.site.tagline, locale)}`, description: tr(st.site.description, locale) }), title: { absolute: `${tr(st.site.name, locale)} — ${tr(st.site.tagline, locale)}` } };
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDict(locale);
  const [st, directions, courses, reviews, stats, faqs, posts] = await Promise.all([
    getSettings(), getDirections(), getCourses(), getApprovedReviews(6), getReviewStats(), getFaqs(), getPosts(3),
  ]);
  const next = courses.map((c) => c.nextGroup).filter(Boolean).sort((a, b) => +a!.startDate - +b!.startDate)[0];
  const featured = courses.filter((c) => c.featured).slice(0, 4);

  const orgLd = {
    "@context": "https://schema.org", "@type": "EducationalOrganization",
    name: tr(st.site.name, locale), description: tr(st.site.description, locale), url: `${siteUrl()}/${locale}`,
    email: st.contacts.email, telephone: st.contacts.phone, address: { "@type": "PostalAddress", addressLocality: "Yerevan", addressCountry: "AM" },
    ...(stats.n > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stats.avg.toFixed(1), reviewCount: stats.n } } : {}),
  };
  const faqLd = faqs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: tr(f.question, locale), acceptedAnswer: { "@type": "Answer", text: tr(f.answer, locale) } })) } : null;

  return (
    <>
      <JsonLd data={orgLd} />
      {faqLd && <JsonLd data={faqLd} />}

      {/* HERO */}
      <section className="bg-grid text-white">
        <div className="container-x flex flex-wrap items-center gap-14 pt-14 pb-28 sm:pt-20">
          <div className="min-w-0 flex-[1_1_520px]">
            <p className="eyebrow !text-gold-300">{tr(st.hero.eyebrow, locale)}</p>
            <h1 className="mt-5 mb-6 font-serif text-[clamp(26px,7.6vw,62px)] leading-[1.12] font-bold">{tr(st.hero.title, locale)}</h1>
            <p className="mb-9 max-w-[560px] text-[18px] text-[#c9d3e1]">{tr(st.hero.subtitle, locale)}</p>
            <div className="flex flex-wrap gap-3.5">
              <Link href={`/${locale}/courses`} className="btn-gold">{t.home.chooseCourse}<Icon name="arrow" size={18} /></Link>
              <Link href={`/${locale}/verify`} className="btn-ghost">{t.home.verifyCert}</Link>
            </div>
          </div>
          <div className="w-full min-w-0 max-w-[500px] flex-[1_1_420px]">
            <div className="overflow-hidden rounded-[18px] border border-gold-500/35 bg-navy-950 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-[#3a4a62]" /><span className="size-2.5 rounded-full bg-[#3a4a62]" /><span className="size-2.5 rounded-full bg-[#3a4a62]" />
                <span className="ml-auto font-mono text-xs text-[#8193ab]">first-project.jsx</span>
              </div>
              <pre className="m-0 overflow-x-auto px-6 py-5 font-mono text-[14px] leading-[1.8] whitespace-pre-wrap text-[#c9d3e1]" aria-label="React code example"><span className="text-[#8193ab]">{"// React"}</span>{"\n"}<span className="text-gold-300">function</span> <span className="text-[#9fd0ff]">Student</span>{"({ name }) {\n  "}<span className="text-gold-300">const</span>{" [skills, setSkills] = useState([]);\n  "}<span className="text-gold-300">return</span>{" (\n    <"}<span className="text-[#9fd0ff]">Portfolio</span>{" owner={name}\n      projects={skills.length} />\n  );\n}"}</pre>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold-500/25 bg-gold-500/10 px-6 py-3.5 text-[13px]">
                {next ? (
                  <>
                    <span className="font-semibold text-gold-300">{fmt(t.home.nextGroup, { date: date(next.startDate, locale) })}</span>
                    <span className="text-[#b9c4d4]">{fmt(t.home.seatsLeft, { n: Math.max(0, next.seats - next.taken) })}</span>
                  </>
                ) : <span className="font-semibold text-gold-300">{t.home.enrollmentOpen}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="container-x relative -mt-12" aria-label="Facts">
        <dl className="card grid grid-cols-2 overflow-hidden shadow-[0_18px_50px_rgba(15,36,64,.10)] lg:grid-cols-4">
          {st.stats.map((x, i) => (
            <div key={i} className="flex flex-col-reverse border-[#eee7d8] p-6 sm:p-7 [&:not(:last-child)]:border-r max-lg:[&:nth-child(2)]:border-r-0 max-lg:[&:nth-child(-n+2)]:border-b">
              <dt className="text-[14px] text-muted">{tr(x.label, locale)}</dt>
              <dd className="font-serif text-[32px] font-bold text-navy-800">{x.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* DIRECTIONS */}
      <section id="directions" className="container-x scroll-mt-24 pt-24">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <div><p className="eyebrow">{t.home.directionsEyebrow}</p><h2 className="h-section mt-2.5">{t.home.directionsTitle}</h2></div>
          <p className="m-0 max-w-[440px] text-muted">{t.home.directionsText}</p>
        </div>
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
          {directions.map((d) => (
            <Link key={d.id} href={`/${locale}/courses?d=${d.slug}`} className="card group flex flex-col gap-5 border-navy-800 bg-navy-800 p-8 text-white no-underline transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="flex size-13 items-center justify-center rounded-2xl bg-gold-500/20 text-gold-300"><Icon name={d.icon} size={26} /></span>
                <span className="chip bg-gold-500 font-semibold text-navy-950">{t.home.active}</span>
              </div>
              <div><h3 className="font-serif text-[26px] font-bold">{tr(d.title, locale)}</h3><p className="mt-1.5 text-[#c9d3e1]">{tr(d.description, locale)}</p></div>
              <div className="flex flex-wrap gap-2.5 text-[13px]">
                <span className="chip ring-1 ring-white/30">{fmt(t.home.coursesCount, { n: d.courseCount })}</span>
                <span className="chip ring-1 ring-white/30">{fmt(t.home.hoursTotal, { n: d.totalHours })}</span>
                <span className="chip ring-1 ring-white/30">{fmt(t.home.age, { n: d.minAge })}</span>
              </div>
            </Link>
          ))}
          <div className="flex flex-col justify-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-[#cdbf9f] p-8">
            <span className="flex size-13 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[#b49b62] text-gold-700"><Icon name="plus" size={24} /></span>
            <h3 className="font-serif text-[22px] font-bold text-navy-900">{t.home.soonTitle}</h3>
            <p className="m-0 text-muted">{t.home.soonText}</p>
            <ActionForm action={subscribeAction} resetOnSuccess className="mt-1.5 flex flex-col gap-2.5">
              <input type="hidden" name="locale" value={locale} />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div className="flex flex-wrap gap-2.5">
                <label htmlFor="sub-email" className="sr-only">{t.home.yourEmail}</label>
                <input id="sub-email" name="email" type="email" required autoComplete="email" placeholder={t.home.yourEmail} className="input min-w-0 flex-[1_1_200px] rounded-full" />
                <SubmitButton pendingText={t.common.sending}>{t.home.subscribe}</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>
      </section>

      {/* COURSES */}
      {featured.length > 0 && (
        <section className="container-x pt-24">
          <p className="eyebrow">{t.home.coursesEyebrow}</p>
          <h2 className="h-section mt-2.5 mb-9">{t.home.coursesTitle}</h2>
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr))]">
            {featured.map((c) => <CourseCard key={c.id} c={c} locale={locale} />)}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="container-x pt-24">
        <p className="eyebrow">{t.home.howEyebrow}</p>
        <h2 className="h-section mt-2.5 mb-9">{t.home.howTitle}</h2>
        <ol className="m-0 grid list-none gap-6 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))]">
          {t.home.steps.map((s, i) => (
            <li key={i} className={`border-t-2 pt-5 ${i === 3 ? "border-gold-500" : "border-navy-800"}`}>
              <span className="font-serif text-[15px] font-bold text-gold-700">0{i + 1}</span>
              <h3 className="mt-1.5 mb-1.5 text-[18px] font-semibold text-navy-900">{s.t}</h3>
              <p className="m-0 text-[14.5px] text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* INSTRUCTOR */}
      <section className="container-x pt-24">
        <div className="card flex flex-wrap items-center gap-10 p-8 sm:p-11">
          <Image src={st.instructor.photoUrl} alt={tr(st.instructor.name, locale)} width={240} height={240} sizes="240px"
            className="size-[200px] flex-none rounded-2xl object-cover sm:size-[240px]" />
          <div className="min-w-0 flex-[1_1_440px]">
            <p className="eyebrow">{t.home.instructorEyebrow}</p>
            <h2 className="mt-2 mb-1 font-serif text-[32px] font-bold text-navy-900">{tr(st.instructor.name, locale)}</h2>
            <p className="mb-4 text-[15px] font-semibold text-gold-700">{tr(st.instructor.role, locale)}</p>
            <p className="mb-5 text-[16px] text-[#3d4757]">{tr(st.instructor.bio, locale)}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">{st.instructor.tags.map((x) => <li key={x} className="chip bg-sand">{x}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="container-x scroll-mt-24 pt-24">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <div><p className="eyebrow">{t.home.reviewsEyebrow}</p><h2 className="h-section mt-2.5">{t.home.reviewsTitle}</h2></div>
          <Link href={`/${locale}/account#review`} className="btn-navy">{t.home.leaveReview}</Link>
        </div>
        {reviews.length ? (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
            {reviews.map((r) => (
              <figure key={r.id} className="card m-0 flex flex-col gap-4 p-7">
                <Stars value={r.rating} label={`${r.rating}/5`} />
                <blockquote className="m-0 text-[#3d4757]">{r.text}</blockquote>
                {r.reply && <p className="m-0 rounded-xl bg-ivory p-3 text-[14px] text-muted">{r.reply}</p>}
                <figcaption className="mt-auto text-[14px]"><b className="text-navy-900">{shortName(r.name)}</b>{r.courseCode ? ` · ${r.courseCode}` : ""}</figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="card p-8 text-muted">{t.home.noReviews}</p>}
      </section>

      {/* VERIFY */}
      <section className="container-x pt-24">
        <div id="certificate" className="flex scroll-mt-24 flex-wrap items-center gap-8 rounded-[22px] bg-navy-900 p-6 text-white sm:gap-11 sm:p-11">
          <a href="/images/certificate-sample.webp" target="_blank" rel="noopener" className="mx-auto block w-full max-w-[240px] flex-none sm:mx-0" aria-label={t.course.certSample}>
            <Image src="/images/certificate-sample.webp" alt={t.course.certSample} width={240} height={339} sizes="240px" className="h-auto w-full rounded-lg shadow-[0_18px_50px_rgba(0,0,0,.45)] ring-1 ring-gold-500/40" />
            <span className="mt-2 block text-center text-[12.5px] text-[#b9c4d4]">{t.course.certSample}</span>
          </a>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <div><p className="eyebrow !text-gold-300">{t.course.certSample}</p><h2 className="mt-2 mb-2 font-serif text-[clamp(24px,5vw,28px)] font-bold">{t.home.verifyTitle}</h2><p className="m-0 text-[#c9d3e1]">{t.course.certText}</p></div>
          <form action={`/${locale}/verify`} className="flex flex-wrap gap-2.5">
            <label htmlFor="cert-no" className="sr-only">{t.verify.number}</label>
            <input id="cert-no" name="n" placeholder="ՖՎԾ-01/2027/001" className="min-h-12 min-w-0 flex-[1_1_220px] rounded-full border border-white/30 bg-white/5 px-5 font-mono text-white placeholder:text-[#8193ab]" />
            <button type="submit" className="btn-gold">{t.verify.check}</button>
          </form>
          </div>
        </div>
      </section>

      {/* FAQ + BLOG */}
      <section className="container-x flex flex-wrap gap-12 pt-24">
        {faqs.length > 0 && (
          <div className="min-w-0 flex-[1_1_520px]">
            <p className="eyebrow">{t.home.faqEyebrow}</p>
            <h2 className="h-section mt-2.5 mb-6">{t.home.faqTitle}</h2>
            <div className="flex flex-col gap-3">
              {faqs.map((f, i) => (
                <details key={f.id} className="card group px-6 py-5" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
                    {tr(f.question, locale)}<Icon name="plus" size={18} className="flex-none text-gold-700 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 mb-0 text-muted">{tr(f.answer, locale)}</p>
                </details>
              ))}
            </div>
          </div>
        )}
        {posts.length > 0 && (
        <div className="min-w-0 flex-[1_1_360px]">
          <p className="eyebrow">{t.home.blogEyebrow}</p>
          <h2 className="h-section mt-2.5 mb-6">{t.home.blogTitle}</h2>
          {posts.map((p) => (
            <Link key={p.id} href={`/${locale}/blog/${p.slug}`} className="card mb-3 block p-6 no-underline transition-shadow hover:shadow-lg">
              <span className="text-[12.5px] font-semibold text-gold-700">{date(p.publishedAt, locale)}</span>
              <span className="mt-1 block font-semibold text-navy-900">{tr(p.title, locale)}</span>
            </Link>
          ))}
          <Link href={`/${locale}/blog`} className="font-semibold">{t.home.allPosts} →</Link>
        </div>
        )}
      </section>

      {/* CTA */}
      <section className="container-x pt-24">
        <div className="bg-grid flex flex-wrap items-center justify-between gap-6 rounded-[22px] p-9 text-white sm:p-12">
          <div><h2 className="font-serif text-[30px] font-bold">{t.home.ctaTitle}</h2><p className="m-0 mt-2 text-[#c9d3e1]">{t.home.ctaText}</p></div>
          <Link href={`/${locale}/courses`} className="btn-gold">{t.home.chooseCourse}<Icon name="arrow" size={18} /></Link>
        </div>
      </section>
    </>
  );
}
