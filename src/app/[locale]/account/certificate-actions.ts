"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prewarmCertificate } from "@/lib/cert-pdf";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getDict, isLocale } from "@/lib/i18n";
import { str } from "@/lib/validate";
import { hashIp } from "@/lib/chat";
import { hyToLatin } from "@/lib/translit";
import type { ActionResult } from "@/components/ActionForm";

const words = (v: string) => v.toLowerCase().normalize("NFKC").replace(/[^\p{L}\s-]/gu, " ").split(/[\s-]+/).filter((w) => w.length > 1);

/** The holder acknowledges receipt by typing their name; the documents open only after that. */
export async function confirmCertReceipt(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = isLocale(str(fd, "locale")) ? str(fd, "locale") : "hy";
  const t = getDict(l).account;
  const user = await getCurrentUser();
  if (!user) return { error: getDict(l).auth.loginTitle };
  const id = str(fd, "id"), name = str(fd, "name").slice(0, 160);
  const [cert] = await db.select().from(s.certificates).where(and(eq(s.certificates.id, id), eq(s.certificates.userId, user.id))).limit(1);
  if (!cert || cert.revoked) return { error: t.receiptErr };
  if (cert.receivedAt) { revalidatePath(`/${l}/account`); return { ok: true }; }
  if (fd.get("agree") !== "on") return { error: t.receiptErr };
  // at least two words, and at least one of them from the name printed on the certificate (Armenian or Latin spelling)
  const typed = words(name);
  const known = new Set([...words(cert.holderName), ...words(cert.holderNameEn || hyToLatin(cert.holderName)), ...words(user.name)]);
  if (typed.length < 2 || !typed.some((w) => known.has(w))) return { error: t.receiptErr };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  await db.update(s.certificates).set({ receivedAt: new Date(), receivedName: name, receivedIpHash: hashIp(ip), receivedUa: (h.get("user-agent") ?? "").slice(0, 300) })
    .where(and(eq(s.certificates.id, id), isNull(s.certificates.receivedAt)));
  revalidatePath(`/${l}/account`);
  revalidatePath("/admin/certificates");
  after(() => prewarmCertificate(id, l)); // the PDFs are ready by the time the holder taps "Download"
  return { ok: true };
}
