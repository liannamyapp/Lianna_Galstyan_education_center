"use server";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, s } from "@/db";
import { checkPassword, createSession, destroySession, getSession, hashPassword } from "@/lib/auth";
import { getDict, fmt, tr, isLocale } from "@/lib/i18n";
import { emailSchema, isBot, str, num } from "@/lib/validate";
import { emailHtml, sendMail } from "@/lib/mail";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { billing, priceFor } from "@/lib/billing";
import type { ActionResult } from "@/components/ActionForm";
import { siteUrl } from "@/lib/seo";

const loc = (fd: FormData) => { const l = str(fd, "locale"); return isLocale(l) ? l : "hy"; };
const safeNext = (n: string, l: string) => (n.startsWith("/") && !n.startsWith("//") ? n : `/${l}/account`);

export async function subscribeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  if (isBot(fd)) return { ok: true, message: t.home.subscribed };
  const e = emailSchema.safeParse(str(fd, "email"));
  if (!e.success) return { error: t.auth.errForm };
  await db.insert(s.subscribers).values({ email: e.data, locale: l }).onConflictDoNothing();
  return { ok: true, message: t.home.subscribed };
}

export async function contactAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  if (isBot(fd)) return { ok: true, message: t.contact.sent };
  const e = emailSchema.safeParse(str(fd, "email"));
  const name = str(fd, "name"), message = str(fd, "message");
  if (!e.success || name.length < 2 || message.length < 5 || message.length > 4000) return { error: t.auth.errForm };
  await db.insert(s.messages).values({ name, email: e.data, phone: str(fd, "phone") || null, message, locale: l });
  const st = await getSettings();
  await sendMail(e.data, t.mail.contactAutoSubject, emailHtml(t.mail.contactAutoSubject, [`${name},`, t.mail.contactAutoBody, t.mail.yourMessage, message]));
  await sendMail(st.adminEmail, `Նոր հաղորդագրություն՝ ${name}`, emailHtml("Նոր հաղորդագրություն կայքից", [`${name} · ${e.data} · ${str(fd, "phone")}`, message], { label: "Պատասխանել", url: `${siteUrl()}/admin/messages` }));
  await notifyAdminWhatsApp(`Նոր հաղորդագրություն կայքից՝ ${name} (${e.data}): ${message.slice(0, 300)}`);
  return { ok: true, message: t.contact.sent };
}

export async function registerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  if (isBot(fd)) return { error: t.auth.errForm };
  const e = emailSchema.safeParse(str(fd, "email"));
  const name = str(fd, "name"), password = String(fd.get("password") ?? ""), phone = str(fd, "phone");
  if (!e.success || name.length < 2 || password.length < 8 || password.length > 200) return { error: t.auth.errForm };
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, e.data)).limit(1);
  if (exists) return { error: t.auth.errExists };
  const [u] = await db.insert(s.users).values({ email: e.data, name, phone: phone || null, passwordHash: await hashPassword(password), locale: l }).returning();
  await createSession(u);
  await sendMail(u.email, t.mail.welcomeSubject, emailHtml(t.mail.welcomeSubject, [`${name},`, t.mail.welcomeBody], { label: t.mail.openAccount, url: `${siteUrl()}/${l}/account` }));
  redirect(safeNext(str(fd, "next"), l));
}

export async function loginAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  const e = emailSchema.safeParse(str(fd, "email"));
  const password = String(fd.get("password") ?? "");
  if (!e.success || !password) return { error: t.auth.errInvalid };
  const [u] = await db.select().from(s.users).where(eq(s.users.email, e.data)).limit(1);
  if (!u || !(await checkPassword(password, u.passwordHash))) {
    await new Promise((r) => setTimeout(r, 400));
    return { error: t.auth.errInvalid };
  }
  await createSession(u);
  const next = str(fd, "next");
  redirect(next ? safeNext(next, l) : u.role === "ADMIN" ? "/admin" : `/${l}/account`);
}

export async function logoutAction(fd: FormData) {
  await destroySession();
  redirect(`/${loc(fd)}`);
}

export async function forgotAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  const e = emailSchema.safeParse(str(fd, "email"));
  if (e.success) {
    const [u] = await db.select().from(s.users).where(eq(s.users.email, e.data)).limit(1);
    if (u) {
      const token = randomBytes(32).toString("hex");
      await db.insert(s.tokens).values({ userId: u.id, type: "reset", token, expiresAt: new Date(Date.now() + 3600_000) });
      await sendMail(u.email, t.mail.resetSubject, emailHtml(t.mail.resetSubject, [t.mail.resetBody], { label: t.mail.resetBtn, url: `${siteUrl()}/${l}/reset?token=${token}` }));
    }
  }
  return { ok: true, message: t.auth.linkSent };
}

export async function resetAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  const token = str(fd, "token"), password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: t.auth.errForm };
  const [tk] = await db.select().from(s.tokens).where(and(eq(s.tokens.token, token), eq(s.tokens.type, "reset"), gt(s.tokens.expiresAt, new Date()))).limit(1);
  if (!tk) return { error: t.auth.errToken };
  await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, tk.userId));
  await db.delete(s.tokens).where(eq(s.tokens.userId, tk.userId));
  return { ok: true, message: t.auth.resetDone };
}

export async function reviewAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  const sess = await getSession();
  if (!sess) return { error: t.auth.loginTitle };
  const rating = Math.round(num(fd, "rating", 5));
  const text = str(fd, "text");
  if (rating < 1 || rating > 5 || text.length < 10 || text.length > 2000) return { error: t.auth.errForm };
  const courseId = str(fd, "courseId") || null;
  await db.insert(s.reviews).values({ userId: sess.uid, courseId, rating, text, locale: l });
  const st = await getSettings();
  await sendMail(st.adminEmail, "Նոր կարծիք՝ սպասում է հաստատման", emailHtml("Նոր կարծիք", [`${sess.name} · ${rating}/5`, text], { label: "Մոդերացիա", url: `${siteUrl()}/admin/reviews` }));
  revalidateTag("reviews");
  return { ok: true, message: t.account.reviewSent };
}

export async function profileAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  const sess = await getSession();
  if (!sess) return { error: t.auth.loginTitle };
  const name = str(fd, "name"), phone = str(fd, "phone"), pw = String(fd.get("password") ?? "");
  if (name.length < 2) return { error: t.auth.errForm };
  const patch: Partial<typeof s.users.$inferInsert> = { name, phone: phone || null, locale: l };
  if (pw) { if (pw.length < 8) return { error: t.auth.errForm }; patch.passwordHash = await hashPassword(pw); }
  await db.update(s.users).set(patch).where(eq(s.users.id, sess.uid));
  return { ok: true, message: t.account.saved };
}

/** Creates an application (and optionally starts a payment). */
export async function enrollAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const l = loc(fd); const t = getDict(l);
  const sess = await getSession();
  if (!sess) redirect(`/${l}/login?next=/${l}/enroll/${str(fd, "slug")}`);
  if (!fd.get("agree")) return { error: t.auth.errForm };
  const [course] = await db.select().from(s.courses).where(and(eq(s.courses.id, str(fd, "courseId")), eq(s.courses.published, true))).limit(1);
  if (!course) return { error: t.common.error };
  const format = str(fd, "format") === "individual" ? "individual" : "group";
  const price = priceFor(course, format);
  const plan = str(fd, "plan") === "full" && price.full ? "full" : "monthly";
  const groupId = format === "group" ? str(fd, "groupId") || null : null;
  const locked = { format, plan, monthlyAmount: price.monthly, fullAmount: price.full, months: course.months };
  const phone = str(fd, "phone"), name = str(fd, "name");
  if (name.length >= 2) await db.update(s.users).set({ name, phone: phone || null }).where(eq(s.users.id, sess.uid));

  let [app] = await db.select().from(s.applications)
    .where(and(eq(s.applications.userId, sess.uid), eq(s.applications.courseId, course.id))).limit(1);
  if (!app || ["REJECTED", "CANCELLED"].includes(app.status)) {
    [app] = await db.insert(s.applications).values({ userId: sess.uid, courseId: course.id, groupId, ...locked, note: str(fd, "note") || null }).returning();
    const [u] = await db.select().from(s.users).where(eq(s.users.id, sess.uid)).limit(1);
    const st = await getSettings();
    const title = tr(course.title, l);
    await sendMail(u.email, t.mail.appSubject, emailHtml(t.mail.appSubject, [`${u.name},`, fmt(t.mail.appBody, { course: title })], { label: t.mail.openAccount, url: `${siteUrl()}/${l}/account` }));
    await sendMail(st.adminEmail, `Նոր հայտ՝ ${course.code}`, emailHtml("Նոր հայտ", [`${u.name} · ${u.email} · ${u.phone ?? ""}`, `${course.code} · ${tr(course.title, "hy")} · ${format === "individual" ? "ԱՆՀԱՏԱԿԱՆ" : "խմբակային"} · ${plan === "full" ? "ամբողջությամբ" : "ամսական"}`], { label: "Բացել հայտերը", url: `${siteUrl()}/admin/applications` }));
    await notifyAdminWhatsApp(`Նոր հայտ՝ ${course.code} · ${u.name} · ${u.phone ?? u.email}`);
  } else if (!app.contractNo) {
    // not paid yet: the learner may still change format, plan or group at today's prices
    [app] = await db.update(s.applications).set({ groupId: format === "group" ? groupId ?? app.groupId : null, ...locked }).where(eq(s.applications.id, app.id)).returning();
  }

  const method = str(fd, "method");
  if (method === "none") return { ok: true, message: t.enroll.applied };
  const st = await getSettings();
  const pays = await db.select().from(s.payments).where(eq(s.payments.applicationId, app.id));
  const b = billing(app, course, null, pays, st.payments);
  if (!b.next) redirect(`/${l}/account`);
  const m = method === "idram" ? "IDRAM" : "CARD";
  const fmtName = app.format === "individual" ? t.format.individual : t.format.group;
  const [pay] = await db.insert(s.payments).values({
    userId: sess.uid, applicationId: app.id, amount: b.next.amount, method: m,
    description: `${course.code} · ${tr(course.title, l)} · ${fmtName} · ${b.plan === "full" ? t.enroll.full : fmt(t.billing.instalment, { i: b.next.index + 1, n: b.months })}`,
  }).returning();
  redirect(`/${l}/pay/${pay.id}`);
}

/** Starts a payment for the next instalment of an application (amount = price locked in the contract). */
export async function payNextAction(fd: FormData) {
  const l = loc(fd);
  const sess = await getSession();
  if (!sess) redirect(`/${l}/login`);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, str(fd, "applicationId")), eq(s.applications.userId, sess.uid)), with: { course: true, group: true, payments: true } });
  if (!app) redirect(`/${l}/account`);
  const st = await getSettings();
  const b = billing(app, app.course, app.group?.startDate, app.payments, st.payments);
  if (!b.next) redirect(`/${l}/account`);
  const t = getDict(l);
  const fmtName = app.format === "individual" ? t.format.individual : t.format.group;
  const [pay] = await db.insert(s.payments).values({
    userId: sess.uid, applicationId: app.id, amount: b.next.amount, method: str(fd, "method") === "idram" ? "IDRAM" : "CARD",
    description: `${app.course.code} · ${tr(app.course.title, l)} · ${fmtName} · ${b.plan === "full" ? t.enroll.full : fmt(t.billing.instalment, { i: b.next.index + 1, n: b.months })}`,
  }).returning();
  redirect(`/${l}/pay/${pay.id}`);
}
