import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { sendMail, emailHtml } from "@/lib/mail";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { getDict, tr } from "@/lib/i18n";
import { syncLeadForUser } from "@/lib/crm/automations";

export { idramEnabled } from "./idram";
export { ameriaEnabled } from "./ameria";
export const testPaymentsAllowed = () => process.env.ALLOW_TEST_PAYMENTS === "true";

/** Idempotently marks a payment as paid and updates the application. */
export async function markPaid(paymentId: string, providerRef?: string, providerData?: unknown) {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || p.status === "PAID") return p;
  await db.update(s.payments).set({ status: "PAID", paidAt: new Date(), providerRef: providerRef ?? p.providerRef, providerData: providerData ?? p.providerData }).where(eq(s.payments.id, p.id));

  if (p.applicationId) {
    const [app] = await db.select().from(s.applications).where(eq(s.applications.id, p.applicationId)).limit(1);
    if (app) {
      const patch: Partial<typeof s.applications.$inferInsert> = {};
      if (!["PAID", "CANCELLED"].includes(app.status)) patch.status = "PAID";
      if (!app.contractNo) {
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.applications).where(sql`${s.applications.contractNo} is not null`);
        patch.contractNo = `ՊՄ-${new Date().getFullYear()}-${String(n + 1).padStart(3, "0")}`;
      }
      if (Object.keys(patch).length) await db.update(s.applications).set(patch).where(eq(s.applications.id, app.id));
    }
  }

  const [u] = await db.select().from(s.users).where(eq(s.users.id, p.userId)).limit(1);
  const st = await getSettings();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (u) {
    const t = getDict(u.locale).mail;
    await sendMail(u.email, t.paidSubject, emailHtml(t.paidSubject, [t.paidBody.replace("{amount}", money(p.amount)), p.description], { label: t.openAccount, url: `${site}/${u.locale}/account` }));
  }
  await sendMail(st.adminEmail, `Վճարում՝ ${money(p.amount)}`, emailHtml("Ստացվել է վճարում", [`${u?.name ?? ""} · ${u?.email ?? ""}`, p.description, `Եղանակ՝ ${p.method}`], { label: "Ադմին", url: `${site}/admin/payments` }));
  await notifyAdminWhatsApp(`Նոր վճարում՝ ${money(p.amount)} · ${u?.name ?? ""} · ${p.description} · ${tr(st.site.name, "hy")}`);
  await syncLeadForUser(p.userId); // CRM: lead → WON + welcome message
  return p;
}

export async function markFailed(paymentId: string, providerData?: unknown, notify = true) {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || p.status === "FAILED" || p.status === "PAID" || p.status === "REFUNDED") return p;
  await db.update(s.payments).set({ status: "FAILED", providerData: providerData ?? p.providerData }).where(eq(s.payments.id, p.id));
  if (notify) await notifyStudent(p, "failed");
  return p;
}

/** Marks a paid payment as refunded and tells the student. */
export async function markRefunded(paymentId: string) {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || p.status !== "PAID") return p;
  await db.update(s.payments).set({ status: "REFUNDED" }).where(eq(s.payments.id, p.id));
  await notifyStudent(p, "refund");
  return p;
}

async function notifyStudent(p: typeof s.payments.$inferSelect, kind: "failed" | "refund") {
  const [u] = await db.select().from(s.users).where(eq(s.users.id, p.userId)).limit(1);
  if (!u) return;
  const t = getDict(u.locale).mail;
  const subject = kind === "failed" ? t.failedSubject : t.refundSubject;
  const body = (kind === "failed" ? t.failedBody : t.refundBody).replace("{amount}", money(p.amount, u.locale as "hy" | "ru" | "en"));
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  await sendMail(u.email, subject, emailHtml(subject, [`${u.name},`, body, p.description], { label: t.openAccount, url: `${site}/${u.locale}/account#payments` })).catch(() => {});
}
