import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { certificatePage, type CertDocKind } from "@/lib/certificate-docs";
import { hyToLatin } from "@/lib/translit";
import { htmlToPdf } from "@/lib/pdf";
import { siteUrl } from "@/lib/seo";

type Cert = typeof s.certificates.$inferSelect & { course: typeof s.courses.$inferSelect };

/** The print page of a certificate document and a cache key that covers only what is printed. */
export async function certificateDoc(cert: Cert, kind: CertDocKind, locale: string, admin: boolean) {
  const modules = await db.select().from(s.courseModules).where(eq(s.courseModules.courseId, cert.courseId)).orderBy(asc(s.courseModules.order));
  const data = {
    number: cert.number, holderName: cert.holderName, holderNameEn: cert.holderNameEn || hyToLatin(cert.holderName),
    startDate: cert.startDate, endDate: cert.endDate, issuedAt: cert.issuedAt,
    projectTopic: cert.projectTopic, projectTopicEn: cert.projectTopicEn, projectUrl: cert.projectUrl, attendance: cert.attendance, revoked: cert.revoked,
    course: cert.course, modules,
  };
  const base = `/${locale}/account/certificate/${cert.id}`;
  const html = certificatePage(data, kind, { hy: `${base}/hy`, en: `${base}/en`, insert: `${base}/insert` }, admin ? "/admin/certificates" : `/${locale}/account#documents`);
  const cacheKey = `cert:v1:${kind}:${JSON.stringify(data)}`;
  return { html, cacheKey };
}

/** Renders the three documents ahead of time (after the holder confirms receipt), so the first download is instant. */
export async function prewarmCertificate(certId: string, locale: string) {
  try {
    const cert = await db.query.certificates.findFirst({ where: eq(s.certificates.id, certId), with: { course: true } });
    if (!cert || cert.revoked) return;
    for (const kind of ["hy", "en", "insert"] as const) {
      const { html, cacheKey } = await certificateDoc(cert, kind, locale, false);
      await htmlToPdf(html, siteUrl(), cacheKey).catch((e) => console.error("[cert prewarm]", (e as Error).message));
    }
  } catch (e) { console.error("[cert prewarm]", (e as Error).message); }
}
