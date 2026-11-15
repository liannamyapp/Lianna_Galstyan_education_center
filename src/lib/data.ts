import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, s } from "@/db";

// Inside caches errors propagate (so a DB hiccup is never cached); guard() returns the fallback outside the cache.
const safe = async <T,>(fn: () => Promise<T>, _fallback: T): Promise<T> => fn();
const fallbackSafe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch (e) { console.error("[data]", (e as Error).message); return fallback; }
};
function guard<A extends unknown[], T>(fn: (...a: A) => Promise<T>, fallback: T) {
  return (...a: A) => fallbackSafe(() => fn(...a), fallback);
}

export type CourseWithMeta = typeof s.courses.$inferSelect & {
  modules: (typeof s.courseModules.$inferSelect)[];
  nextGroup: (typeof s.groups.$inferSelect & { taken: number }) | null;
  direction?: typeof s.directions.$inferSelect;
};

async function nextGroups(courseIds: string[]) {
  if (!courseIds.length) return new Map<string, typeof s.groups.$inferSelect & { taken: number }>();
  const rows = await db.select().from(s.groups)
    .where(and(inArray(s.groups.courseId, courseIds), inArray(s.groups.status, ["OPEN", "FULL"]), gte(s.groups.startDate, new Date(Date.now() - 86400000))))
    .orderBy(asc(s.groups.startDate));
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db.select({ g: s.applications.groupId, n: sql<number>`count(*)::int` }).from(s.applications)
        .where(and(inArray(s.applications.groupId, ids), inArray(s.applications.status, ["APPROVED", "PAID"]))).groupBy(s.applications.groupId)
    : [];
  const cmap = new Map(counts.map((c) => [c.g, c.n]));
  const m = new Map<string, typeof s.groups.$inferSelect & { taken: number }>();
  for (const r of rows) if (!m.has(r.courseId)) m.set(r.courseId, { ...r, taken: cmap.get(r.id) ?? 0 });
  return m;
}

const _getDirections = unstable_cache(
  () => safe(async () => {
    const dirs = await db.select().from(s.directions).where(eq(s.directions.published, true)).orderBy(asc(s.directions.order));
    const stats = await db.select({ d: s.courses.directionId, n: sql<number>`count(*)::int`, h: sql<number>`coalesce(sum(${s.courses.hours}),0)::int`, age: sql<number>`coalesce(min(${s.courses.minAge}),16)::int` })
      .from(s.courses).where(eq(s.courses.published, true)).groupBy(s.courses.directionId);
    const sm = new Map(stats.map((x) => [x.d, x]));
    return dirs.map((d) => ({ ...d, courseCount: sm.get(d.id)?.n ?? 0, totalHours: sm.get(d.id)?.h ?? 0, minAge: sm.get(d.id)?.age ?? 16 }));
  }, []),
  ["directions"], { tags: ["content"], revalidate: 600 }
);
export const getDirections = guard(_getDirections, [] as Awaited<ReturnType<typeof _getDirections>>);

const _getCourses = unstable_cache(
  (directionSlug?: string) => safe(async (): Promise<CourseWithMeta[]> => {
    const list = await db.query.courses.findMany({
      where: eq(s.courses.published, true),
      orderBy: [asc(s.courses.order)],
      with: { modules: { orderBy: [asc(s.courseModules.order)] }, direction: true },
    });
    const filtered = directionSlug ? list.filter((c) => c.direction.slug === directionSlug) : list;
    const ng = await nextGroups(filtered.map((c) => c.id));
    return filtered.map((c) => ({ ...c, nextGroup: ng.get(c.id) ?? null }));
  }, []),
  ["courses"], { tags: ["content"], revalidate: 600 }
);
export const getCourses = guard(_getCourses, [] as Awaited<ReturnType<typeof _getCourses>>);

const _getCourse = unstable_cache(
  (slug: string) => safe(async () => {
    const c = await db.query.courses.findFirst({
      where: and(eq(s.courses.slug, slug), eq(s.courses.published, true)),
      with: { modules: { orderBy: [asc(s.courseModules.order)] }, direction: true },
    });
    if (!c) return null;
    const groups = await db.select().from(s.groups)
      .where(and(eq(s.groups.courseId, c.id), inArray(s.groups.status, ["OPEN", "FULL"]), gte(s.groups.startDate, new Date(Date.now() - 86400000))))
      .orderBy(asc(s.groups.startDate));
    const ng = await nextGroups([c.id]);
    return { ...c, groups, nextGroup: ng.get(c.id) ?? null };
  }, null),
  ["course"], { tags: ["content"], revalidate: 600 }
);
export const getCourse = guard(_getCourse, null as Awaited<ReturnType<typeof _getCourse>>);

const _getApprovedReviews = unstable_cache(
  (limit = 6) => safe(async () => db.select({
    id: s.reviews.id, rating: s.reviews.rating, text: s.reviews.text, reply: s.reviews.reply, createdAt: s.reviews.createdAt,
    locale: s.reviews.locale, textI18n: s.reviews.textI18n, replyI18n: s.reviews.replyI18n,
    name: s.users.name, courseCode: s.courses.code,
  }).from(s.reviews).innerJoin(s.users, eq(s.users.id, s.reviews.userId)).leftJoin(s.courses, eq(s.courses.id, s.reviews.courseId))
    .where(eq(s.reviews.status, "APPROVED")).orderBy(desc(s.reviews.createdAt)).limit(limit), []),
  ["reviews"], { tags: ["reviews"], revalidate: 600 }
);
export const getApprovedReviews = guard(_getApprovedReviews, [] as Awaited<ReturnType<typeof _getApprovedReviews>>);

const _getReviewStats = unstable_cache(
  () => safe(async () => {
    const [r] = await db.select({ n: sql<number>`count(*)::int`, avg: sql<number>`coalesce(avg(${s.reviews.rating}),0)::float` }).from(s.reviews).where(eq(s.reviews.status, "APPROVED"));
    return r ?? { n: 0, avg: 0 };
  }, { n: 0, avg: 0 }),
  ["review-stats"], { tags: ["reviews"], revalidate: 600 }
);
export const getReviewStats = guard(_getReviewStats, { n: 0, avg: 0 } as Awaited<ReturnType<typeof _getReviewStats>>);

const _getFaqs = unstable_cache(
  () => safe(() => db.select().from(s.faqs).where(eq(s.faqs.published, true)).orderBy(asc(s.faqs.order)), []),
  ["faqs"], { tags: ["content"], revalidate: 600 }
);
export const getFaqs = guard(_getFaqs, [] as Awaited<ReturnType<typeof _getFaqs>>);

const _getPosts = unstable_cache(
  (limit = 50) => safe(() => db.select().from(s.posts).where(eq(s.posts.published, true)).orderBy(desc(s.posts.publishedAt)).limit(limit), []),
  ["posts"], { tags: ["content"], revalidate: 600 }
);
export const getPosts = guard(_getPosts, [] as Awaited<ReturnType<typeof _getPosts>>);

const _getPost = unstable_cache(
  (slug: string) => safe(async () => (await db.select().from(s.posts).where(and(eq(s.posts.slug, slug), eq(s.posts.published, true))).limit(1))[0] ?? null, null),
  ["post"], { tags: ["content"], revalidate: 600 }
);
export const getPost = guard(_getPost, null as Awaited<ReturnType<typeof _getPost>>);

const _getPage = unstable_cache(
  (slug: string) => safe(async () => (await db.select().from(s.pages).where(eq(s.pages.slug, slug)).limit(1))[0] ?? null, null),
  ["page"], { tags: ["content"], revalidate: 600 }
);
export const getPage = guard(_getPage, null as Awaited<ReturnType<typeof _getPage>>);

export async function findCertificate(number: string) {
  return fallbackSafe(async () => {
    const n = number.trim().toUpperCase().replace(/\s+/g, "");
    if (!n) return null;
    const [c] = await db.select({
      number: s.certificates.number, holderName: s.certificates.holderName, startDate: s.certificates.startDate, endDate: s.certificates.endDate,
      issuedAt: s.certificates.issuedAt, revoked: s.certificates.revoked, courseTitle: s.courses.title, hours: s.courses.hours, code: s.courses.code,
    }).from(s.certificates).innerJoin(s.courses, eq(s.courses.id, s.certificates.courseId)).where(sql`upper(${s.certificates.number}) = ${n}`).limit(1);
    return c ?? null;
  }, null);
}
