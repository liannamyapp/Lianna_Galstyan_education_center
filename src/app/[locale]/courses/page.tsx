import type { Metadata } from "next";
import Link from "next/link";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { getCourses, getDirections } from "@/lib/data";
import { CourseCard } from "@/components/CourseCard";
import { pageMeta } from "@/lib/seo";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return pageMeta({ locale, path: "/courses", title: t.nav.courses, description: t.home.directionsText });
}

export default async function Courses({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ d?: string }> }) {
  const { locale } = await params;
  const { d } = await searchParams;
  const t = getDict(locale);
  const [dirs, courses] = await Promise.all([getDirections(), getCourses()]);
  const list = d ? courses.filter((c) => c.direction?.slug === d) : courses;
  return (
    <>
      <section className="bg-grid text-white">
        <div className="container-x py-16">
          <p className="eyebrow !text-gold-300">{t.home.coursesEyebrow}</p>
          <h1 className="mt-3 font-serif text-[clamp(28px,6.5vw,52px)] font-bold">{t.home.coursesTitle}</h1>
          <p className="mt-3 max-w-[620px] text-[17px] text-[#c9d3e1]">{t.home.directionsText}</p>
        </div>
      </section>
      <div className="container-x pt-10">
        {dirs.length > 1 && (
          <nav aria-label={t.nav.directions} className="mb-8 flex flex-wrap gap-2.5">
            <Link href={`/${locale}/courses`} aria-current={!d ? "page" : undefined} className={`chip min-h-11 px-5 no-underline ${!d ? "bg-navy-800 text-white" : "bg-sand text-navy-800"}`}>{t.course.allCourses}</Link>
            {dirs.map((x) => (
              <Link key={x.id} href={`/${locale}/courses?d=${x.slug}`} aria-current={d === x.slug ? "page" : undefined} className={`chip min-h-11 px-5 no-underline ${d === x.slug ? "bg-navy-800 text-white" : "bg-sand text-navy-800"}`}>{tr(x.title, locale)}</Link>
            ))}
          </nav>
        )}
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr))]">
          {list.map((c) => <CourseCard key={c.id} c={c} locale={locale} level={2} />)}
        </div>
      </div>
    </>
  );
}
