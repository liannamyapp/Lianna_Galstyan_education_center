import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, s } from "@/db";
import type { LeadStage } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { date, dateShort } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { emailHtml, sendMail } from "@/lib/mail";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { getCrmSettings } from "./config";
import { addTask, advanceStage, ensureDefaultTemplates, getTemplate, logActivity, prettyPhone, recalcScore, render, setStage, upsertLead, type Lead, type LeadInput } from "./leads";
import { bestChannel, reachable, sendToLead } from "./channels";
import { OPEN_STAGES, sourceHy, stageHy } from "./constants";

const DAY = 86_400_000;
const firstName = (n: string) => n.split(/\s+/)[0] || n;

/** Variables for message templates. */
export async function templateVars(l: Lead): Promise<Record<string, string>> {
  const st = await getSettings();
  const loc = l.locale;
  const course = l.courseId ? (await db.select().from(s.courses).where(eq(s.courses.id, l.courseId)).limit(1))[0] : null;
  const grp = (await db.select().from(s.groups)
    .where(and(eq(s.groups.status, "OPEN"), gt(s.groups.startDate, new Date()), ...(course ? [eq(s.groups.courseId, course.id)] : [])))
    .orderBy(asc(s.groups.startDate)).limit(1))[0];
  const link = l.userId ? `${siteUrl()}/${loc}/account` : course ? `${siteUrl()}/${loc}/courses/${course.slug}` : `${siteUrl()}/${loc}/courses`;
  return {
    name: firstName(l.name),
    course: course ? tr(course.title, loc) : "",
    date: grp ? date(grp.startDate, loc as "hy") : l.nextActionAt ? date(l.nextActionAt, loc as "hy") : "",
    link,
    phone: st.contacts.phone,
    center: tr(st.site.name, loc),
  };
}

/** Sends a stored template to the lead on its best channel (or the given one). Idempotent per `key`. */
export async function sendTemplate(l: Lead, templateKey: string, opts: { key?: string; channel?: Parameters<typeof sendToLead>[1]; marketing?: boolean; vars?: Record<string, string>; noEmail?: boolean } = {}) {
  const key = opts.key ?? templateKey;
  if (opts.key && l.sent.includes(key)) return { ok: false, skipped: true };
  if (opts.noEmail && (!opts.channel || opts.channel === "auto")) {
    const messengers = reachable(l).filter((c) => c !== "email");
    if (!messengers.length) return { ok: false, skipped: true };
    const best = await bestChannel(l);
    opts = { ...opts, channel: best && best !== "email" ? best : messengers[0] };
  }
  const t = await getTemplate(templateKey);
  if (!t) return { ok: false, error: "template" };
  const vars = { ...(await templateVars(l)), ...(opts.vars ?? {}) };
  const res = await sendToLead(l, opts.channel ?? "auto", { text: render(t.body, l.locale, vars), subject: render(t.subject, l.locale, vars), marketing: opts.marketing ?? true, key });
  if (res.ok && opts.key) {
    await db.update(s.leads).set({ sent: sql`${s.leads.sent} || ${JSON.stringify([key])}::jsonb` }).where(eq(s.leads.id, l.id));
    l.sent = [...l.sent, key];
  }
  return res;
}

/**
 * Speed-to-lead: runs once for every new lead.
 *  1. instant auto-reply on the channel they used
 *  2. a task for the admin to make personal contact within N minutes
 *  3. admin notification (only for sources the site doesn't already notify about)
 */
export async function onNewLead(lead: Lead, opts: { notify?: boolean; autoReply?: boolean } = {}) {
  const cfg = await getCrmSettings();
  try {
    if (cfg.autoReply && opts.autoReply !== false && reachable(lead).length)
      await sendTemplate(lead, "welcome", { key: "welcome", marketing: false, noEmail: lead.source.startsWith("site_") });
    const first = lead.phone ? `Զանգահարել՝ ${lead.name} (${prettyPhone(lead.phone)})` : `Կապ հաստատել՝ ${lead.name}`;
    await addTask(lead.id, first, new Date(Date.now() + cfg.speedMinutes * 60_000), true);
    await db.update(s.leads).set({ nextActionAt: new Date(Date.now() + cfg.speedMinutes * 60_000), nextAction: first }).where(eq(s.leads.id, lead.id));
    if (opts.notify !== false) {
      const url = `${siteUrl()}/admin/crm/leads/${lead.id}`;
      await notifyAdminWhatsApp(`🆕 Նոր լիդ՝ ${lead.name} · ${sourceHy[lead.source] ?? lead.source}${lead.phone ? ` · ${prettyPhone(lead.phone)}` : ""}\n${url}`);
    }
  } catch (e) { console.error("[crm] onNewLead", e); }
}

/** Reads first-touch attribution saved by the middleware (cookie `lg_utm`). */
export async function readUtm() {
  try {
    const { cookies } = await import("next/headers");
    const raw = (await cookies()).get("lg_utm")?.value;
    return raw ? JSON.parse(decodeURIComponent(raw)) : {};
  } catch { return {}; }
}

/** Entry point used by the website forms. Never throws: the CRM must not break the site. */
export async function captureLead(i: LeadInput, opts: { notify?: boolean; stage?: LeadStage; silent?: boolean } = {}) {
  try {
    const utm = i.utm ?? (await readUtm());
    const { lead, created } = await upsertLead({ ...i, utm, channel: i.channel ?? "site" });
    if (opts.stage) await advanceStage(lead.id, opts.stage);
    if (created && !opts.silent) await onNewLead(lead, opts);
    return lead;
  } catch (e) {
    console.error("[crm] captureLead", e);
    return null;
  }
}

/* ---------------- sync with the rest of the site ---------------- */
const appToStage: Record<string, LeadStage | undefined> = { NEW: "NEW", INTERVIEW: "CONSULTATION", APPROVED: "NEGOTIATION", PAID: "WON" };

/** Keeps the lead of one user in step with their applications (called after payments / admin edits). */
export async function syncLeadForUser(userId: string) {
  try {
    const [u] = await db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    if (!u || u.role === "ADMIN") return;
    const apps = await db.select().from(s.applications).where(eq(s.applications.userId, userId)).orderBy(desc(s.applications.updatedAt));
    const active = apps.find((a) => !["REJECTED", "CANCELLED"].includes(a.status));
    const { lead, created } = await upsertLead({
      userId, name: u.name, email: u.email, phone: u.phone, locale: u.locale, createdAt: u.createdAt, imported: Date.now() - u.createdAt.getTime() > DAY,
      source: apps.length ? "site_enroll" : "site_register", courseId: (active ?? apps[0])?.courseId, format: (active ?? apps[0])?.format,
    });
    if (created) await logActivity(lead.id, "system", "Ստեղծվեց կայքի տվյալներից (համաժամեցում)");
    if (active) {
      const target = appToStage[active.status];
      if (target === "WON" && lead.stage !== "WON") {
        await setStage(lead.id, "WON", "Վճարումը ստացվել է");
        // welcome only fresh payments (not learners who paid long before the CRM existed)
        const [recent] = await db.select({ id: s.payments.id }).from(s.payments)
          .where(and(eq(s.payments.applicationId, active.id), eq(s.payments.status, "PAID"), gte(s.payments.paidAt, new Date(Date.now() - 2 * DAY)))).limit(1);
        const fresh = (await db.select().from(s.leads).where(eq(s.leads.id, lead.id)).limit(1))[0];
        if (recent) await sendTemplate(fresh, "won", { key: `won:${active.id}`, marketing: false, noEmail: true });
      } else if (target && !(lead.stage === "LOST" && active.updatedAt <= lead.stageChangedAt)) await advanceStage(lead.id, target, "Ըստ հայտի կարգավիճակի");
    } else if (apps.length && lead.stage !== "WON" && lead.stage !== "LOST") {
      await setStage(lead.id, "LOST", "Հայտը մերժվել / չեղարկվել է");
    }
  } catch (e) { console.error("[crm] syncLeadForUser", e); }
}

/** Creates leads for everyone already on the site (users, contact messages, subscribers). Safe to run many times. */
export async function syncFromSite() {
  await ensureDefaultTemplates();
  let created = 0;
  const known = await db.select({ userId: s.leads.userId, email: s.leads.email }).from(s.leads);
  const users = new Set(known.map((k) => k.userId).filter(Boolean));
  const emails = new Set(known.map((k) => k.email).filter(Boolean));

  const students = await db.select().from(s.users).where(eq(s.users.role, "STUDENT"));
  for (const u of students) {
    await syncLeadForUser(u.id);
    if (!users.has(u.id)) { created++; emails.add(u.email); }
  }
  const msgs = await db.select().from(s.messages).orderBy(asc(s.messages.createdAt));
  for (const m of msgs) {
    if (emails.has(m.email.toLowerCase())) continue;
    const { lead } = await upsertLead({ name: m.name, email: m.email, phone: m.phone, locale: m.locale, source: "site_contact", message: m.message, channel: "site", createdAt: m.createdAt, imported: true });
    if (m.handled) await advanceStage(lead.id, "CONTACTED");
    emails.add(m.email.toLowerCase()); created++;
  }
  const subs = await db.select().from(s.subscribers);
  for (const x of subs) {
    if (emails.has(x.email)) continue;
    await upsertLead({ name: x.email.split("@")[0], email: x.email, locale: x.locale, source: "site_subscribe", tags: ["բաժանորդ"], createdAt: x.createdAt, imported: true });
    emails.add(x.email); created++;
  }
  return { created };
}

/* ---------------- daily automation ---------------- */
export async function runCrmDaily() {
  const cfg = await getCrmSettings();
  await ensureDefaultTemplates();
  const report = { synced: 0, followUps: 0, reminders: 0, reengaged: 0, reviews: 0, lost: 0, tasks: 0, rescored: 0 };
  let budget = cfg.dailyLimit;
  const now = Date.now();

  report.synced = (await syncFromSite()).created;

  // 1. follow-ups to silent new leads (only if they haven't replied since our last message)
  if (cfg.followUps) {
    const leads = await db.select().from(s.leads).where(and(inArray(s.leads.stage, ["NEW", "CONTACTED"]), eq(s.leads.unsubscribed, false)));
    for (const l of leads) {
      if (budget <= 0) break;
      const age = (now - new Date(l.createdAt).getTime()) / DAY;
      if (age > Math.max(...cfg.followUpDays, 0) + 7) continue; // old leads (e.g. imported) are not chased
      const awaitingUs = l.lastInboundAt && (!l.lastContactAt || new Date(l.lastInboundAt) > new Date(l.lastContactAt));
      if (awaitingUs) continue; // they wrote and are waiting: a human should answer, not a robot
      const step = cfg.followUpDays.map((d, i) => ({ d, i })).filter(({ d }) => age >= d).pop();
      if (!step) continue;
      const key = `fu${step.i + 1}`;
      if (l.sent.includes(key) || !reachable(l).length) continue;
      const r = await sendTemplate(l, `followup_${Math.min(step.i + 1, 3)}`, { key });
      if (r.ok) { report.followUps++; budget--; }
    }
  }

  // 2. day-before reminders for consultations / trial lessons
  if (cfg.reminders) {
    const off = 4 * 3_600_000; // Asia/Yerevan, UTC+4 all year
    const tomorrowStart = new Date(Math.floor((now + off) / DAY) * DAY - off + DAY), tomorrowEnd = new Date(tomorrowStart.getTime() + DAY);
    const due = await db.select().from(s.leads).where(and(inArray(s.leads.stage, ["CONSULTATION", "TRIAL"]), gte(s.leads.nextActionAt, tomorrowStart), lt(s.leads.nextActionAt, tomorrowEnd)));
    for (const l of due) {
      if (budget <= 0) break;
      const r = await sendTemplate(l, "reminder", { key: `rem:${dateShort(l.nextActionAt)}`, marketing: false, vars: { date: date(l.nextActionAt, l.locale as "hy") } });
      if (r.ok) { report.reminders++; budget--; }
    }
  }

  // 3. silent for too long → LOST (with a reason), so the pipeline stays honest
  if (cfg.autoLoseDays > 0) {
    const cutoff = new Date(now - cfg.autoLoseDays * DAY);
    const stale = await db.select().from(s.leads).where(and(inArray(s.leads.stage, OPEN_STAGES), lt(s.leads.stageChangedAt, cutoff),
      or(isNull(s.leads.lastInboundAt), lt(s.leads.lastInboundAt, cutoff)),
      or(isNull(s.leads.nextActionAt), lt(s.leads.nextActionAt, new Date(now)))));
    for (const l of stale) { await setStage(l.id, "LOST", `Ավտոմատ՝ ${cfg.autoLoseDays} օր պատասխան չկա`); report.lost++; }
  }

  // 4. re-engage LOST leads once, when a new group is open
  if (cfg.reengageDays > 0) {
    const hasOpenGroup = (await db.select({ id: s.groups.id }).from(s.groups).where(and(eq(s.groups.status, "OPEN"), gt(s.groups.startDate, new Date()))).limit(1)).length > 0;
    if (hasOpenGroup) {
      const lost = await db.select().from(s.leads).where(and(eq(s.leads.stage, "LOST"), lt(s.leads.stageChangedAt, new Date(now - cfg.reengageDays * DAY)), eq(s.leads.unsubscribed, false)));
      for (const l of lost) {
        if (budget <= 0) break;
        if (l.sent.includes("reengage") || !reachable(l).length) continue;
        const r = await sendTemplate(l, "reengage", { key: "reengage" });
        if (r.ok) { report.reengaged++; budget--; await addTask(l.id, `Վերաակտիվացում՝ ստուգել պատասխանը · ${l.name}`, new Date(now + 2 * DAY), true); }
      }
    }
  }

  // 5. course finished → ask for a review and a recommendation
  if (cfg.reviewRequest) {
    const won = await db.select().from(s.leads).where(and(eq(s.leads.stage, "WON"), sql`${s.leads.userId} is not null`));
    for (const l of won) {
      if (budget <= 0) break;
      if (l.sent.includes("review")) continue;
      const apps = await db.query.applications.findMany({ where: and(eq(s.applications.userId, l.userId!), eq(s.applications.status, "PAID")), with: { course: true, group: true } });
      const finished = apps.some((a) => {
        const start = a.group?.startDate ?? a.startDate;
        if (!start) return false;
        const end = new Date(start).getTime() + a.course.weeks * 7 * DAY;
        return end < now && end > now - 30 * DAY; // finished within the last month
      });
      if (!finished) continue;
      const r = await sendTemplate(l, "review", { key: "review", marketing: false });
      if (r.ok) { report.reviews++; budget--; }
    }
  }

  // 6. open leads without a planned next step get a task
  const orphans = await db.select().from(s.leads).where(and(inArray(s.leads.stage, OPEN_STAGES), or(isNull(s.leads.nextActionAt), lt(s.leads.nextActionAt, new Date(now - 3 * DAY)))));
  for (const l of orphans) {
    const open = await db.select({ id: s.crmTasks.id }).from(s.crmTasks).where(and(eq(s.crmTasks.leadId, l.id), eq(s.crmTasks.done, false))).limit(1);
    if (open.length) continue;
    await addTask(l.id, `Հաջորդ քայլ՝ ${l.name} (${stageHy[l.stage]})`, new Date(now + 3_600_000), true);
    report.tasks++;
  }

  // 7. rescore everyone in the pipeline (recency changes daily)
  const open = await db.select({ id: s.leads.id }).from(s.leads).where(inArray(s.leads.stage, OPEN_STAGES));
  for (const l of open) { await recalcScore(l.id); report.rescored++; }

  if (cfg.digest) await sendDigest();
  return report;
}

/** Morning summary for the admin: tasks, hot leads, yesterday's numbers. */
export async function sendDigest() {
  const st = await getSettings();
  const now = Date.now();
  const tasks = await db.query.crmTasks.findMany({ where: and(eq(s.crmTasks.done, false), lte(s.crmTasks.dueAt, new Date(now + DAY))), with: { lead: true }, orderBy: [asc(s.crmTasks.dueAt)], limit: 30 });
  const hot = (await db.select().from(s.leads).where(and(inArray(s.leads.stage, OPEN_STAGES), gte(s.leads.score, 70))).orderBy(desc(s.leads.score)).limit(10));
  const [{ n: newLeads }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.leads).where(gte(s.leads.createdAt, new Date(now - DAY)));
  const [{ n: won }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.leads).where(and(eq(s.leads.stage, "WON"), gte(s.leads.wonAt, new Date(now - DAY))));
  if (!tasks.length && !hot.length && !newLeads) return;
  const lines = [
    `Վերջին 24 ժամում՝ ${newLeads} նոր լիդ, ${won} գրանցում։`,
    tasks.length ? `Այսօրվա առաջադրանքներ (${tasks.length})՝` : "Այսօր առաջադրանքներ չկան։",
    ...tasks.map((t) => `• ${t.title}${t.dueAt.getTime() < now ? " — ուշացած" : ""}`),
    ...(hot.length ? ["", `Տաք լիդեր (${hot.length})՝`, ...hot.map((l) => `• ${l.name} · ${l.score} միավոր · ${stageHy[l.stage]}${l.phone ? ` · ${prettyPhone(l.phone)}` : ""}`)] : []),
  ];
  await sendMail(st.adminEmail, `CRM՝ այսօրվա պլանը (${tasks.length} առաջադրանք)`, emailHtml("Այսօրվա պլանը", lines, { label: "Բացել CRM-ը", url: `${siteUrl()}/admin/crm` }));
  await notifyAdminWhatsApp(`📋 CRM՝ այսօր\n${lines.slice(0, 18).join("\n")}\n${siteUrl()}/admin/crm`);
}

