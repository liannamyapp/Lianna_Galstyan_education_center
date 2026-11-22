import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import type { CertDocKind } from "@/lib/certificate-docs";
import { certificateDoc } from "@/lib/cert-pdf";
import { hyToLatin } from "@/lib/translit";
import { htmlToPdf, pdfHeaders, pdfFailedPage } from "@/lib/pdf";

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
  // the holder opens the documents only after acknowledging receipt in their account (admins always can)
  if (user.role !== "ADMIN" && !cert.receivedAt) return Response.redirect(new URL(`/${locale}/account#documents`, req.url), 302);
  const { html, cacheKey } = await certificateDoc(cert, kind, locale, user.role === "ADMIN");
  if (new URL(req.url).searchParams.has("download")) {
    const url = new URL(req.url);
    const who = (cert.holderNameEn || hyToLatin(cert.holderName)).trim();
    const name = `ALTA_${kind === "insert" ? "Supplement" : kind === "en" ? "Certificate_EN" : "Certificate_HY"}_${hyToLatin(cert.number).toUpperCase().replace(/[\\/]/g, "-")}_${who}.pdf`;
    // In-app browsers (Instagram, Facebook, Telegram, Android WebView) can't save downloads: open the PDF inline there,
    // so their built-in viewer's "Share → Save to Files" works. Regular browsers get a normal file download.
    const ua = req.headers.get("user-agent") ?? "";
    const inline = /Instagram|FBAN|FBAV|Telegram|Line\/|; wv\)|GSA\//i.test(ua);
    try {
      const pdf = await htmlToPdf(html, url.origin, cacheKey);
      return new Response(Buffer.from(pdf), { headers: pdfHeaders(name, inline) });
    } catch (e) {
      console.error("certificate pdf failed", e);
      return new Response(pdfFailedPage(url.pathname, `${url.pathname}?download=1&r=${Date.now()}`), { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "3" } });
    }
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex" } });
}
