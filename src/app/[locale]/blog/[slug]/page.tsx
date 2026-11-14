import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { getPost, getPosts } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { date } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { JsonLd, pageMeta, siteUrl } from "@/lib/seo";

export const revalidate = 600;
export async function generateStaticParams() { return (await getPosts()).map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getPost(slug);
  if (!p) return {};
  return pageMeta({ locale, path: `/blog/${slug}`, title: tr(p.title, locale), description: tr(p.excerpt, locale), image: p.coverUrl ?? undefined, type: "article" });
}

export default async function Post({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const [p, st] = await Promise.all([getPost(slug), getSettings()]);
  if (!p) notFound();
  const t = getDict(locale);
  const ld = { "@context": "https://schema.org", "@type": "BlogPosting", headline: tr(p.title, locale), description: tr(p.excerpt, locale), datePublished: p.publishedAt, dateModified: p.updatedAt, image: p.coverUrl ? [p.coverUrl] : undefined, author: { "@type": "Person", name: tr(st.instructor.name, locale) }, mainEntityOfPage: `${siteUrl()}/${locale}/blog/${slug}` };
  return (
    <article className="container-x max-w-[780px] pt-14">
      <JsonLd data={ld} />
      <Link href={`/${locale}/blog`} className="text-[14px] font-semibold">← {t.blog.back}</Link>
      <p className="mt-6 text-[13px] font-semibold text-gold-700">{date(p.publishedAt, locale)}</p>
      <h1 className="mt-2 font-serif text-[clamp(26px,6vw,44px)] leading-tight font-bold text-navy-900">{tr(p.title, locale)}</h1>
      {p.coverUrl && <Image src={p.coverUrl} alt="" width={1560} height={860} priority sizes="(max-width: 820px) 100vw, 780px" className="mt-8 h-auto w-full rounded-2xl" />}
      <div className="prose-lg mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(tr(p.body, locale)) }} />
    </article>
  );
}
