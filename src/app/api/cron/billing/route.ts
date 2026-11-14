import { revalidateTag } from "next/cache";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { getSettings } from "@/lib/settings";
import { billing } from "@/lib/billing";
import { emailHtml, sendMail } from "@/lib/mail";
import { notifyAdminWhatsApp, sendWhatsApp } from "@/lib/whatsapp";
import { fmt, getDict, isLocale, tr } from "@/lib/i18n";
import { date, money } from "@/lib/format";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily automation (Vercel Cron, see vercel.json):
 *  - payment reminders N days before, on the due day, and an access-paused notice when overdue
 *  - expires abandoned checkouts
 *  - keeps group statuses (FULL / RUNNING / FINISHED) up to date
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret ? auth !== `Bearer ${secret}` : process.env.NODE_ENV === "production") return new Response("Unauthorized", { status: 401 });

  const st = await getSettings();
  const site = siteUrl();
  const report = { reminders: 0, due: 0, locked: 0, expired: 0, groups: 0 };
  const adminLines: string[] = [];

  const apps = await db.query.applications.findMany({
    where: eq(s.applications.status, "PAID"),
    with: { user: true, course: true, group: true, payments: true },
  });

  for (const a of apps) {
    const b = billing(a, a.course, a.group?.startDate, a.payments, st.payments);
    if (!b.next || !["soon", "due", "overdue"].includes(b.state)) continue;
    const kind = b.state === "soon" ? "pre" : b.state === "due" ? "due" : "lock";
    const key = `${b.next.index}:${kind}`;
    if (a.reminders.includes(key)) continue;

    const l = isLocale(a.user.locale) ? a.user.locale : "hy";
    const t = getDict(l);
    const vars = { course: tr(a.course.title, l), amount: money(b.next.amount, l), date: date(b.next.due, l), days: b.daysLeft ?? 0, n: Math.abs(b.daysLeft ?? 0) };
    const subject = fmt(kind === "pre" ? t.mailx.preSubject : kind === "due" ? t.mailx.dueSubject : t.mailx.lockSubject, vars);
    const body = fmt(kind === "pre" ? t.mailx.preBody : kind === "due" ? t.mailx.dueBody : t.mailx.lockBody, vars);
    const url = `${site}/${l}/account`;

    await sendMail(a.user.email, subject, emailHtml(subject, [`${a.user.name},`, body], { label: t.mailx.payBtn, url }));
    await sendWhatsApp(a.user.phone, `${subject}\n\n${body}\n\n${url}`);
    await db.update(s.applications).set({ reminders: [...a.reminders, key] }).where(eq(s.applications.id, a.id));

    if (kind === "pre") report.reminders++;
    else if (kind === "due") report.due++;
    else { report.locked++; adminLines.push(`${a.user.name} · ${a.course.code} · ${money(b.next.amount)} · ուշացում ${vars.n} օր · ${a.user.phone ?? a.user.email}`); }
  }

  // abandoned checkouts older than 2 days
  const expired = await db.update(s.payments).set({ status: "FAILED" })
    .where(and(eq(s.payments.status, "PENDING"), lt(s.payments.createdAt, new Date(Date.now() - 2 * 86_400_000)))).returning({ id: s.payments.id });
  report.expired = expired.length;

  // group statuses
  const groups = await db.query.groups.findMany({ where: inArray(s.groups.status, ["OPEN", "FULL", "RUNNING"]), with: { course: true } });
  const taken = await db.select({ g: s.applications.groupId, n: sql<number>`count(*)::int` }).from(s.applications)
    .where(inArray(s.applications.status, ["APPROVED", "PAID"])).groupBy(s.applications.groupId);
  const takenBy = new Map(taken.map((x) => [x.g, x.n]));
  const now = Date.now();
  for (const g of groups) {
    const start = new Date(g.startDate).getTime();
    const end = start + g.course.weeks * 7 * 86_400_000;
    const n = takenBy.get(g.id) ?? 0;
    const next = now > end ? "FINISHED" : now >= start ? "RUNNING" : n >= g.seats ? "FULL" : "OPEN";
    if (g.status === "FULL" && next === "OPEN") continue; // a group closed manually stays closed
    if (next !== g.status) { await db.update(s.groups).set({ status: next }).where(eq(s.groups.id, g.id)); report.groups++; }
  }
  if (report.groups) revalidateTag("content");

  if (adminLines.length) {
    await sendMail(st.adminEmail, `Ուշացած վճարումներ՝ ${adminLines.length}`, emailHtml("Ուշացած վճարումներ (մուտքը դադարեցված է)", adminLines, { label: "Բացել վճարումները", url: `${site}/admin/payments` }));
    await notifyAdminWhatsApp(`Ուշացած վճարումներ՝\n${adminLines.join("\n")}`);
  }
  return Response.json({ ok: true, ...report });
}
