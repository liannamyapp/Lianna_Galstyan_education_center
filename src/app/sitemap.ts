import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { getCourses, getPosts } from "@/lib/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [courses, posts] = await Promise.all([getCourses(), getPosts(500)]);
  const entry = (path: string, lastModified?: Date, priority = 0.7): MetadataRoute.Sitemap =>
    locales.map((l) => ({
      url: `${base}/${l}${path}`,
      lastModified: lastModified ?? new Date(),
      priority,
      alternates: { languages: Object.fromEntries(locales.map((x) => [x === "hy" ? "hy-AM" : x, `${base}/${x}${path}`])) },
    }));
  return [
    ...entry("", undefined, 1),
    ...entry("/courses", undefined, 0.9),
    ...courses.map((c) => entry(`/courses/${c.slug}`, c.updatedAt ?? undefined, 0.9)).flat(),
    ...entry("/blog", undefined, 0.6),
    ...posts.map((p) => entry(`/blog/${p.slug}`, p.updatedAt, 0.6)).flat(),
    ...entry("/verify", undefined, 0.4),
    ...entry("/contact", undefined, 0.6),
    ...["contract", "refund", "privacy"].map((x) => entry(`/p/${x}`, undefined, 0.3)).flat(),
  ];
}
