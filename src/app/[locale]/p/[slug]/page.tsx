import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr, type Locale } from "@/lib/i18n";
import { getPage } from "@/lib/data";
import { date } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { pageMeta } from "@/lib/seo";

export const revalidate = 600;
export function generateStaticParams() { return ["contract", "refund", "privacy"].map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getPage(slug);
  if (!p) return {};
  return pageMeta({ locale, path: `/p/${slug}`, title: tr(p.title, locale), description: tr(p.body, locale).replace(/[#*_>\-]/g, "").slice(0, 155) });
}

export default async function StaticPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const p = await getPage(slug);
  if (!p) notFound();
  return (
    <article className="container-x max-w-[820px] pt-14">
      <h1 className="font-serif text-[clamp(28px,3.6vw,40px)] font-bold text-navy-900">{tr(p.title, locale)}</h1>
      <p className="mt-2 text-[13px] text-muted">{date(p.updatedAt, locale)}</p>
      <div className="prose-lg card mt-8 p-7 sm:p-10" dangerouslySetInnerHTML={{ __html: renderMarkdown(tr(p.body, locale)) }} />
    </article>
  );
}
