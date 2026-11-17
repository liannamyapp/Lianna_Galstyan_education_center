import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr, type Locale } from "@/lib/i18n";
import { getPage } from "@/lib/data";
import { date } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { pageMeta } from "@/lib/seo";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { ContractDocument } from "@/components/ContractDocument";
import { contractTemplate, drawBlanks, fillContract, providerParty } from "@/lib/contract";
import { blank } from "@/lib/escape";
import Link from "next/link";

export const revalidate = 600;
export function generateStaticParams() { return ["contract", "refund", "privacy"].map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getPage(slug);
  if (!p) return {};
  if (slug === "contract") { const c = getDict(locale).contract as Record<string, string>; return pageMeta({ locale, path: `/p/${slug}`, title: c.sampleTitle, description: c.sampleNote }); }
  return pageMeta({ locale, path: `/p/${slug}`, title: tr(p.title, locale), description: tr(p.body, locale).replace(/[#*_>\-]/g, "").slice(0, 155) });
}

export default async function StaticPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  if (slug === "contract") return <SampleContract locale={locale} />;
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

/** Public sample: the full agreement with labelled blanks and a SAMPLE watermark. */
async function SampleContract({ locale }: { locale: Locale }) {
  const d = getDict(locale); const t = d.contract as Record<string, string>;
  const [st, tpl] = await Promise.all([getSettings(), contractTemplate()]);
  const body = drawBlanks(renderMarkdown(fillContract(tpl[locale], null, locale)));
  return (
    <article className="container-x max-w-[900px] pt-12">
      <h1 className="font-serif text-[clamp(28px,3.6vw,40px)] font-bold text-navy-900">{t.sampleTitle}</h1>
      <p className="mt-3 max-w-[680px] text-[15px] text-muted">{t.sampleNote}</p>
      <div className="mt-4 mb-8 flex flex-wrap gap-3">
        <Link href={`/${locale}/courses`} className="btn-gold min-h-11 px-6">{d.nav.register ?? d.course.enrollPay}</Link>
        <Link href={`/${locale}/p/refund`} className="btn-soft min-h-11 px-5">{t.refundLink}</Link>
      </div>
      <ContractDocument
        locale={locale} labels={t} tagline={tr(st.site.tagline, locale)} no={t.noBlank} dateText={blank(t.dateBlank)} sample signed={null}
        provider={providerParty(st, locale, t)}
        client={{ name: blank(t.clientName), lines: [`${blank(t.clientEmail)} · ${blank(t.clientPhone)}`] }}
        bodyHtml={body}
      />
    </article>
  );
}
