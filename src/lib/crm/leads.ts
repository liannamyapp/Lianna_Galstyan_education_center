import "server-only";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { db, s } from "@/db";
import type { L10n, LeadStage, Utm } from "@/db/schema";
import { tr } from "@/lib/i18n";
import { DEFAULT_TEMPLATES } from "./config";
import { scoreLead } from "./score";
import { STAGES } from "./constants";

export type Lead = typeof s.leads.$inferSelect;

/** "077 12-34-56", "+374 77 123456" → "37477123456". Returns null when it can't be a phone number. */
export function normPhone(p?: string | null): string | null {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 9) d = "374" + d.slice(1);
  if (d.length === 8) d = "374" + d; // 77123456
  return d.length >= 10 && d.length <= 15 ? d : null;
}
export const normEmail = (e?: string | null) => {
  const v = (e || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
};
export const prettyPhone = (d?: string | null) => (d ? `+${d}` : "");

export type LeadInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  telegramChatId?: string | null;
  telegramUsername?: string | null;
  instagramId?: string | null;
  facebookId?: string | null;
  locale?: string | null;
  source?: string;
  utm?: Utm | null;
  courseId?: string | null;
  format?: string | null;
  userId?: string | null;
  tags?: string[];
  /** Text the person sent us (logged as an inbound message). */
  message?: string | null;
  channel?: string | null;
  stage?: LeadStage;
  /** Original date for records imported from the site (keeps reports honest). */
  createdAt?: Date;
  /** Imported records are not chased by the follow-up robot. */
  imported?: boolean;
};

export async function logActivity(leadId: string, type: string, body = "", channel?: string | null, meta: Record<string, unknown> = {}) {
  await db.insert(s.leadActivities).values({ leadId, type, body: body.slice(0, 8000), channel: channel ?? null, meta });
}

export async function addTask(leadId: string | null, title: string, dueAt: Date, auto = false) {
  const [t] = await db.insert(s.crmTasks).values({ leadId, title, dueAt, auto }).returning();
  return t;
}

/** Finds an existing lead by any known identifier. */
export async function findLead(i: LeadInput): Promise<Lead | null> {
  const phone = normPhone(i.phone), email = normEmail(i.email);
  const conds: SQL[] = [];
  if (i.userId) conds.push(eq(s.leads.userId, i.userId));
  if (phone) conds.push(eq(s.leads.phone, phone));
  if (email) conds.push(eq(s.leads.email, email));
  if (i.telegramChatId) conds.push(eq(s.leads.telegramChatId, i.telegramChatId));
  if (i.instagramId) conds.push(eq(s.leads.instagramId, i.instagramId));
  if (i.facebookId) conds.push(eq(s.leads.facebookId, i.facebookId));
  if (!conds.length) return null;
  // prefer an open lead, then the most recent one
  const rows = await db.select().from(s.leads).where(or(...conds))
    .orderBy(sql`case when ${s.leads.stage} in ('WON','LOST') then 1 else 0 end`, sql`${s.leads.createdAt} desc`).limit(1);
  return rows[0] ?? null;
}

/**
 * Creates a lead or enriches the existing one (never overwrites data the admin already has).
 * Returns { lead, created }. Callers decide whether to run the new-lead automation.
 */
export async function upsertLead(i: LeadInput): Promise<{ lead: Lead; created: boolean }> {
  const phone = normPhone(i.phone), email = normEmail(i.email);
  const now = new Date();
  const existing = await findLead(i);
  if (existing) {
    const patch: Partial<typeof s.leads.$inferInsert> = {};
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.email && email) patch.email = email;
    if (!existing.telegramChatId && i.telegramChatId) patch.telegramChatId = i.telegramChatId;
    if (!existing.telegramUsername && i.telegramUsername) patch.telegramUsername = i.telegramUsername;
    if (!existing.instagramId && i.instagramId) patch.instagramId = i.instagramId;
    if (!existing.facebookId && i.facebookId) patch.facebookId = i.facebookId;
    if (!existing.userId && i.userId) patch.userId = i.userId;
    if (!existing.courseId && i.courseId) patch.courseId = i.courseId;
    if (!existing.format && i.format) patch.format = i.format;
    if ((!existing.name || /^(Instagram|Facebook|Telegram|WhatsApp)/.test(existing.name)) && i.name) patch.name = i.name.slice(0, 120);
    if (i.tags?.length) patch.tags = Array.from(new Set([...existing.tags, ...i.tags]));
    if (i.message) patch.lastInboundAt = now;
    // a LOST lead that writes again comes back to the pipeline
    if (i.message && existing.stage === "LOST") { patch.stage = "NEW"; patch.stageChangedAt = now; patch.sent = []; }
    const [lead] = Object.keys(patch).length ? await db.update(s.leads).set(patch).where(eq(s.leads.id, existing.id)).returning() : [existing];
    if (i.message) await logActivity(lead.id, "message_in", i.message, i.channel ?? null);
    if (patch.stage === "NEW") await logActivity(lead.id, "stage", "Կորցրածից վերադարձ՝ նոր հաղորդագրության պատճառով", null, { from: "LOST", to: "NEW" });
    lead.score = await recalcScore(lead.id);
    return { lead, created: false };
  }

  const [lead] = await db.insert(s.leads).values({
    name: (i.name || email || (phone ? `+${phone}` : "") || "Անանուն").slice(0, 120),
    phone, email,
    telegramChatId: i.telegramChatId ?? null, telegramUsername: i.telegramUsername ?? null,
    instagramId: i.instagramId ?? null, facebookId: i.facebookId ?? null,
    locale: i.locale && ["hy", "ru", "en"].includes(i.locale) ? i.locale : "hy",
    source: i.source || "other", utm: i.utm ?? {},
    courseId: i.courseId ?? null, format: i.format ?? null, userId: i.userId ?? null,
    tags: i.tags ?? [], stage: i.stage ?? "NEW",
    lastInboundAt: i.message ? (i.createdAt ?? now) : null,
    ...(i.createdAt ? { createdAt: i.createdAt, stageChangedAt: i.createdAt } : {}),
    ...(i.imported ? { sent: ["welcome", "fu1", "fu2", "fu3"] } : {}),
  }).returning();
  await logActivity(lead.id, "system", "Լիդը ստեղծվեց", i.channel ?? null, { source: lead.source, utm: lead.utm });
  if (i.message) await logActivity(lead.id, "message_in", i.message, i.channel ?? null);
  await recalcScore(lead.id);
  return { lead, created: true };
}

/** Moves a lead to another stage and records it in the timeline. */
export async function setStage(leadId: string, stage: LeadStage, note?: string) {
  const [cur] = await db.select().from(s.leads).where(eq(s.leads.id, leadId)).limit(1);
  if (!cur || cur.stage === stage) return cur;
  const patch: Partial<typeof s.leads.$inferInsert> = { stage, stageChangedAt: new Date() };
  if (stage === "WON") patch.wonAt = new Date();
  if (stage === "LOST" && note) patch.lostReason = note;
  if (stage !== "LOST") patch.lostReason = null;
  const [lead] = await db.update(s.leads).set(patch).where(eq(s.leads.id, leadId)).returning();
  await logActivity(leadId, "stage", note ?? "", null, { from: cur.stage, to: stage });
  await recalcScore(leadId);
  return lead;
}

/** Moves forward only (never back), e.g. NEW → CONSULTATION, but CONSULTATION stays when asked for CONTACTED. */
export async function advanceStage(leadId: string, stage: LeadStage, note?: string) {
  const [cur] = await db.select({ stage: s.leads.stage }).from(s.leads).where(eq(s.leads.id, leadId)).limit(1);
  if (!cur) return;
  const order = (x: LeadStage) => (x === "LOST" ? -1 : STAGES.indexOf(x));
  if (cur.stage === "WON") return;
  if (cur.stage === "LOST" || order(stage) > order(cur.stage)) await setStage(leadId, stage, note);
}

export async function recalcScore(leadId: string) {
  const [l] = await db.select().from(s.leads).where(eq(s.leads.id, leadId)).limit(1);
  if (!l) return 0;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.leadActivities)
    .where(and(eq(s.leadActivities.leadId, leadId), eq(s.leadActivities.type, "message_in")));
  const { score } = scoreLead({ ...l, inboundCount: n, hasUser: Boolean(l.userId) });
  if (score !== l.score) await db.update(s.leads).set({ score }).where(eq(s.leads.id, leadId));
  return score;
}

/**
 * Records a message we sent outside the CRM (admin "Messages" reply, WhatsApp from the phone)
 * on the matching lead, so the timeline and the response-time statistics stay complete.
 */
export async function logOutbound(who: LeadInput, text: string, channel: string) {
  try {
    const lead = await findLead(who);
    if (!lead) return null;
    await logActivity(lead.id, "message_out", text, channel, { ok: true, external: true });
    const now = new Date();
    await db.update(s.leads).set({ lastContactAt: now, ...(lead.firstResponseAt ? {} : { firstResponseAt: now }) }).where(eq(s.leads.id, lead.id));
    if (lead.stage === "NEW") await setStage(lead.id, "CONTACTED", "Պատասխանել եք");
    return lead;
  } catch (e) { console.error("[crm] logOutbound", e); return null; }
}

/* ---------------- templates ---------------- */
export async function ensureDefaultTemplates() {
  await db.insert(s.crmTemplates).values(DEFAULT_TEMPLATES).onConflictDoNothing({ target: s.crmTemplates.key });
}

export async function getTemplate(key: string) {
  const [t] = await db.select().from(s.crmTemplates).where(eq(s.crmTemplates.key, key)).limit(1);
  if (t) return t;
  const d = DEFAULT_TEMPLATES.find((x) => x.key === key);
  return d ? { id: "", createdAt: new Date(), ...d } : null;
}

/** Fills {name}, {course}, {date}, {link}, {phone}, {center} in a localized template. */
export function render(text: L10n | string, locale: string, vars: Record<string, string>) {
  const raw = typeof text === "string" ? text : tr(text, locale);
  return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/* ---------------- unsubscribe links ---------------- */
const secret = () => process.env.AUTH_SECRET || "dev";
export const unsubToken = (leadId: string) => createHmac("sha256", secret()).update(`unsub:${leadId}`).digest("hex").slice(0, 32);
