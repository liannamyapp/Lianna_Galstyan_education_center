import { nextContractNo } from "@/lib/contract";
import { notifyStudent as tellStudent } from "@/lib/notify";
import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { sendMail, emailHtml } from "@/lib/mail";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { getDict, tr } from "@/lib/i18n";
import { syncLeadForUser } from "@/lib/crm/automations";
import type { L10n } from "@/db/schema";

export { idramEnabled } from "./idram";
export { ameriaEnabled } from "./ameria";
/** Test payments ("payment successful" button without money) — only for admins checking the flow, never for learners. */
export const testPaymentsAllowed = (role: string | null | undefined) => process.env.ALLOW_TEST_PAYMENTS === "true" && role === "ADMIN";
/** Can this method be paid online right now? (Until the bank's vPOS / Idram are connected, learners pay in cash or by transfer.) */
export async function canPayOnline(method: string, role?: string | null) {
  const { idramEnabled: idram } = await import("./idram");
  const { ameriaEnabled: card } = await import("./ameria");
  return testPaymentsAllowed(role) || (method === "idram" ? idram() : card());
}
export async function anyOnlinePayment() {
  const { idramEnabled: idram } = await import("./idram");
  const { ameriaEnabled: card } = await import("./ameria");
  return idram() || card();
}

/** Idempotently marks a payment as paid and updates the application. */
export async function markPaid(paymentId: string, providerRef?: string, providerData?: unknown) {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || p.status === "PAID") return p;
  await db.update(s.payments).set({ status: "PAID", paidAt: new Date(), providerRef: providerRef ?? p.providerRef, providerData: providerData ?? p.providerData }).where(eq(s.payments.id, p.id));

  let activated: { code: string; title: L10n } | null = null; // the course, when this payment activated the training
  if (p.applicationId) {
    const [app] = await db.select().from(s.applications).where(eq(s.applications.id, p.applicationId)).limit(1);
    if (app) {
      const patch: Partial<typeof s.applications.$inferInsert> = {};
      if (!["PAID", "CANCELLED"].includes(app.status)) {
        patch.status = "PAID";
        const [c] = await db.select({ code: s.courses.code, title: s.courses.title }).from(s.courses).where(eq(s.courses.id, app.courseId)).limit(1);
        if (c) activated = c;
      }
      if (!app.contractNo) {
        patch.contractNo = await nextContractNo();
      }
      if (Object.keys(patch).length) await db.update(s.applications).set(patch).where(eq(s.applications.id, app.id));
    }
  }

  const [u] = await db.select().from(s.users).where(eq(s.users.id, p.userId)).limit(1);
  const st = await getSettings();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (u) {
    const t = getDict(u.locale).mail;
    const c = activated as { code: string; title: L10n } | null;
    const on = c ? t.statusMail.PAID[1].replace("{course}", `${c.code} · ${tr(c.title, u.locale)}`) : "";
    await tellStudent(u, c ? `${t.paidSubject} · ${t.statusMail.PAID[0]}` : t.paidSubject, [t.paidBody.replace("{amount}", money(p.amount)), p.description, on], { label: t.openAccount, url: `${site}/${u.locale}/account` }, { greet: false });
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
  await tellStudent(u, subject, [body, p.description], { label: t.openAccount, url: `${site}/${u.locale}/account#payments` });
}
