import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { loadRegister, registerHtml, registerMeta, registerXlsx } from "@/lib/cert-register";
import { htmlToPdf, pdfHeaders } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Certificate register for the admin.
 *   GET /api/admin/certificates/register?format=html|xlsx|pdf&year=2026&course=<courseId>
 */
export async function GET(req: Request) {
  const me = await getCurrentUser(); // role from the database, not the cookie
  if (me?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "html";
  const y = Number(url.searchParams.get("year"));
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
  const courseId = url.searchParams.get("course") || null;
  const course = courseId ? (await db.select().from(s.courses).where(eq(s.courses.id, courseId)).limit(1))[0] : undefined;

  const rows = await loadRegister({ year, courseId: course?.id ?? null });
  const meta = await registerMeta({ year }, course?.code);
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yerevan" }).format(new Date());
  const base = `ALTA_Certificate_Register${year ? `_${year}` : ""}${course ? `_${course.slug}` : ""}_${stamp}`;
  const qs = (f: string) => { const q = new URLSearchParams(url.searchParams); q.set("format", f); return `?${q}`; };

  if (format === "xlsx") {
    const buf = await registerXlsx(rows, meta);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "pdf") {
    try {
      const pdf = await htmlToPdf(registerHtml(rows, meta), url.origin);
      return new Response(new Uint8Array(pdf), { headers: pdfHeaders(`${base}.pdf`) });
    } catch (e) {
      console.error("[register] pdf", e);
      return new Response("PDF-ը չհաջողվեց ստեղծել։ Փորձեք նորից կամ օգտագործեք «Տպել» կոճակը։", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  }
  return new Response(registerHtml(rows, meta, { xlsx: qs("xlsx"), pdf: qs("pdf"), back: "/admin/certificates" }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
