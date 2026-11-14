import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDict, tr, fmt, type Locale } from "@/lib/i18n";
import { date } from "@/lib/format";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";
import { playable } from "@/lib/video";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function Lessons({ params, searchParams }: { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ l?: string }> }) {
  const { locale, id } = await params;
  const { l: selected } = await searchParams;
  const t = getDict(locale);
  const user = await requireUser(locale);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, id), eq(s.applications.userId, user.id)), with: { course: true, group: true, payments: true } });
  if (!app) notFound();
  const st = await getSettings();
  const b = billing(app, app.course, app.group?.startDate, app.payments, st.payments);
  const allowed = app.status === "PAID" && !b.locked;

  const list = allowed ? await db.select().from(s.lessons).where(and(
    eq(s.lessons.courseId, app.courseId), eq(s.lessons.published, true),
    app.groupId ? or(isNull(s.lessons.groupId), eq(s.lessons.groupId, app.groupId)) : isNull(s.lessons.groupId),
    or(isNull(s.lessons.userId), eq(s.lessons.userId, user.id)),
  )).orderBy(asc(s.lessons.order), asc(s.lessons.lessonDate), asc(s.lessons.createdAt)) : [];
  const current = list.find((x) => x.id === selected) ?? list[list.length - 1]; // newest lesson by default
  const media = current?.videoUrl ? playable(current.videoUrl) : null;

  return (
    <div className="container-x pt-9">
      <Link href={`/${locale}/account`} className="text-[14px] font-semibold no-underline">← {t.lessons.back}</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{app.course.code} · {app.format === "individual" ? t.format.individual : t.format.group}</p>
          <h1 className="mt-1 font-serif text-[30px] font-bold text-navy-900">{t.lessons.title} · {tr(app.course.title, locale)}</h1>
        </div>
        {allowed && <span className="chip bg-sand text-navy-800">{fmt(t.lessons.count, { n: list.length })}</span>}
      </div>

      {!allowed ? (
        <div className="card flex items-center gap-3 p-7 text-[#7a2a1a]"><Icon name="lock" />{b.locked ? t.lessons.locked : t.account.status[app.status]}{b.locked && <Link href={`/${locale}/account`} className="btn-navy ml-auto min-h-11">{t.account.payNow}</Link>}</div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-muted">{t.lessons.empty}</div>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <section className="min-w-0 flex-[999_1_620px]" aria-label={current ? tr(current.title, locale) : undefined}>
            <div className="overflow-hidden rounded-[18px] bg-navy-950 shadow-[0_20px_50px_rgba(15,36,64,.25)]">
              {media?.kind === "iframe" && <iframe src={media.src} title={tr(current.title, locale)} className="aspect-video w-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />}
              {media?.kind === "video" && <video key={media.src} src={media.src} controls preload="metadata" playsInline className="aspect-video w-full bg-black" />}
              {(!media || media.kind === "link") && (
                <div className="flex aspect-video items-center justify-center p-8 text-center text-white">
                  {media ? <a href={media.src} target="_blank" rel="noopener noreferrer" className="btn-gold"><Icon name="play" size={18} />{t.lessons.watch}</a> : <Icon name="file" size={42} className="text-gold-300" />}
                </div>
              )}
            </div>
            <div className="card mt-4 flex flex-wrap items-center gap-4 p-6">
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-[19px] font-semibold text-navy-900">{tr(current.title, locale)}</h2>
                <p className="m-0 mt-1 text-[13.5px] text-muted">{[current.moduleCode, date(current.lessonDate, locale)].filter(Boolean).join(" · ")}</p>
              </div>
              {media?.download && <a href={media.download} download className="btn-navy min-h-11"><Icon name="download" size={18} />{t.lessons.download}</a>}
              {current.materialsUrl && <a href={current.materialsUrl} target="_blank" rel="noopener noreferrer" className="btn-soft min-h-11"><Icon name="file" size={18} />{t.lessons.materials}</a>}
            </div>
          </section>
          <nav aria-label={t.lessons.title} className="card min-w-0 flex-[1_1_300px] overflow-hidden p-2">
            <ol className="m-0 flex max-h-[70vh] list-none flex-col overflow-y-auto p-0">
              {list.map((x, i) => {
                const on = x.id === current.id;
                return (
                  <li key={x.id}>
                    <Link href={`/${locale}/account/lessons/${app.id}?l=${x.id}`} aria-current={on ? "true" : undefined} scroll={false}
                      className={`flex items-start gap-3 rounded-xl px-3.5 py-3 no-underline ${on ? "bg-navy-900 text-white" : "text-ink hover:bg-ivory"}`}>
                      <span className={`mt-0.5 flex size-7 flex-none items-center justify-center rounded-full text-[12px] font-bold ${on ? "bg-gold-500 text-navy-950" : "bg-sand text-navy-800"}`}>{i + 1}</span>
                      <span className="min-w-0"><span className="block text-[14.5px] font-semibold">{tr(x.title, locale)}</span><span className={`block text-[12.5px] ${on ? "text-[#c9d3e1]" : "text-muted"}`}>{[x.moduleCode, date(x.lessonDate, locale)].filter(Boolean).join(" · ")}</span></span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      )}
    </div>
  );
}
