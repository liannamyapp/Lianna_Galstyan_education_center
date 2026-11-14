import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { getPosts } from "@/lib/data";
import { date } from "@/lib/format";
import { pageMeta } from "@/lib/seo";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return pageMeta({ locale, path: "/blog", title: t.blog.title, description: t.blog.subtitle });
}

export default async function Blog({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDict(locale);
  const posts = await getPosts();
  return (
    <div className="container-x pt-16">
      <p className="eyebrow">{t.home.blogEyebrow}</p>
      <h1 className="h-section mt-2.5">{t.blog.title}</h1>
      <p className="mt-2 text-muted">{t.blog.subtitle}</p>
      {posts.length === 0 ? <p className="card mt-10 p-8 text-muted">{t.blog.empty}</p> : (
        <div className="mt-10 grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
          {posts.map((p, i) => (
            <article key={p.id} className="card relative flex flex-col overflow-hidden">
              {p.coverUrl && <Image src={p.coverUrl} alt="" width={680} height={380} sizes="(max-width: 768px) 100vw, 400px" priority={i < 2} className="aspect-[16/9] h-auto w-full object-cover" />}
              <div className="flex flex-1 flex-col gap-2 p-6">
                <span className="text-[12.5px] font-semibold text-gold-700">{date(p.publishedAt, locale)}</span>
                <h2 className="text-[19px] font-semibold text-navy-900"><Link href={`/${locale}/blog/${p.slug}`} className="text-inherit no-underline after:absolute after:inset-0">{tr(p.title, locale)}</Link></h2>
                <p className="m-0 text-[14.5px] text-muted">{tr(p.excerpt, locale)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
