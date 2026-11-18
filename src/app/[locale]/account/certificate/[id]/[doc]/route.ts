import { asc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { certificatePage, type CertDocKind } from "@/lib/certificate-docs";
import { hyToLatin } from "@/lib/translit";
import { htmlToPdf, pdfHeaders } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Print-ready certificate (Armenian / English) and its bilingual supplement — for the holder and admins only. */
export async function GET(req: Request, { params }: { params: Promise<{ locale: string; id: string; doc: string }> }) {
  const { locale, id, doc } = await params;
  const kind = (["hy", "en", "insert"].includes(doc) ? doc : "hy") as CertDocKind;
  const user = await getCurrentUser();
  if (!user) return Response.redirect(new URL(`/${locale}/login`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"), 302);
  const cert = await db.query.certificates.findFirst({ where: eq(s.certificates.id, id), with: { course: true } });
  if (!cert || (user.role !== "ADMIN" && cert.userId !== user.id)) return new Response("Not found", { status: 404 });
  const modules = await db.select().from(s.courseModules).where(eq(s.courseModules.courseId, cert.courseId)).orderBy(asc(s.courseModules.order));
  const base = `/${locale}/account/certificate/${id}`;
  const html = certificatePage(
    {
      number: cert.number, holderName: cert.holderName, holderNameEn: cert.holderNameEn || hyToLatin(cert.holderName),
      startDate: cert.startDate, endDate: cert.endDate, issuedAt: cert.issuedAt,
      projectTopic: cert.projectTopic, projectTopicEn: cert.projectTopicEn, projectUrl: cert.projectUrl, attendance: cert.attendance, revoked: cert.revoked,
      course: cert.course, modules,
    },
    kind,
    { hy: `${base}/hy`, en: `${base}/en`, insert: `${base}/insert` },
    user.role === "ADMIN" ? "/admin/certificates" : `/${locale}/account#documents`,
  );
  if (new URL(req.url).searchParams.has("download")) {
    const origin = new URL(req.url).origin;
    const pdf = await htmlToPdf(html, origin);
    const who = (cert.holderNameEn || hyToLatin(cert.holderName)).trim();
    const name = `ALTA_${kind === "insert" ? "Supplement" : kind === "en" ? "Certificate_EN" : "Certificate_HY"}_${hyToLatin(cert.number).toUpperCase().replace(/[\\/]/g, "-")}_${who}.pdf`;
    return new Response(Buffer.from(pdf), { headers: pdfHeaders(name) });
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex" } });
}
