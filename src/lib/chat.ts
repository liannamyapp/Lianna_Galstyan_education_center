import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { emailHtml, sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/seo";
import { captureLead } from "@/lib/crm/automations";
import { logOutbound, normEmail } from "@/lib/crm/leads";

export const CHAT_COOKIE = "alta_chat";
export const CHAT_MAX_LEN = 2000;
/** a visitor may send at most this many messages per 10 minutes */
const VISITOR_BURST = 15;
/** at most this many new conversations per network per hour */
const THREADS_PER_IP_HOUR = 5;
/** one e-mail to the academy per conversation per this many minutes */
const ADMIN_NOTIFY_EVERY_MIN = 10;
/** the visitor counts as "still on the site" if the widget polled within this many seconds */
const VISITOR_ONLINE_SEC = 90;

export type Thread = typeof s.chatThreads.$inferSelect;
export type ChatMessage = typeof s.chatMessages.$inferSelect;

export const newToken = () => randomBytes(24).toString("base64url");
export const hashIp = (ip: string | null) => (ip ? createHash("sha256").update(`alta-chat:${ip}`).digest("hex").slice(0, 32) : null);

export async function threadByToken(token: string | undefined | null): Promise<Thread | null> {
  if (!token || token.length < 20 || token.length > 64) return null;
  const [t] = await db.select().from(s.chatThreads).where(eq(s.chatThreads.token, token)).limit(1);
  return t ?? null;
}

export async function tooManyThreads(ipHash: string | null) {
  if (!ipHash) return false;
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.chatThreads)
    .where(and(eq(s.chatThreads.ipHash, ipHash), gt(s.chatThreads.createdAt, new Date(Date.now() - 3600_000))));
  return (r?.n ?? 0) >= THREADS_PER_IP_HOUR;
}

export async function tooManyMessages(threadId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.chatMessages)
    .where(and(eq(s.chatMessages.threadId, threadId), eq(s.chatMessages.sender, "visitor"), gt(s.chatMessages.createdAt, new Date(Date.now() - 600_000))));
  return (r?.n ?? 0) >= VISITOR_BURST;
}

export const publicMessage = (m: ChatMessage) => ({ id: m.id, from: m.sender === "admin" ? "admin" : "visitor", body: m.body, at: m.createdAt.toISOString() });

/** Saves the visitor's contact details on the conversation and in the CRM (never overwrites with blanks). */
export async function saveContact(t: Thread, name: string | null, email: string | null, firstMessage?: string) {
  const n = name?.trim().slice(0, 120) || null, e = normEmail(email);
  const patch: Partial<Thread> = {};
  if (n && n !== t.name) patch.name = n;
  if (e && e !== t.email) patch.email = e;
  if (Object.keys(patch).length) await db.update(s.chatThreads).set(patch).where(eq(s.chatThreads.id, t.id));
  const merged = { ...t, ...patch };
  if (merged.email && !merged.leadId) {
    const lead = await captureLead({ name: merged.name || merged.email.split("@")[0], email: merged.email, userId: merged.userId, locale: merged.locale, source: "site_chat", message: firstMessage ?? null, channel: "site" }, { notify: false });
    if (lead) await db.update(s.chatThreads).set({ leadId: lead.id }).where(eq(s.chatThreads.id, t.id));
    return { ...merged, leadId: lead?.id ?? null };
  }
  return merged;
}

/** E-mails the academy about new visitor messages, at most once per ADMIN_NOTIFY_EVERY_MIN per conversation. */
export async function notifyAdmin(t: Thread, body: string) {
  try {
    if (t.adminNotifiedAt && Date.now() - t.adminNotifiedAt.getTime() < ADMIN_NOTIFY_EVERY_MIN * 60_000) return;
    const st = await getSettings();
    const to = st.adminEmail || st.contacts.email;
    if (!to) return;
    await db.update(s.chatThreads).set({ adminNotifiedAt: new Date() }).where(eq(s.chatThreads.id, t.id));
    const who = t.name || t.email || "Կայքի այցելու";
    await sendMail(to, `Նոր հաղորդագրություն չատում՝ ${who}`, emailHtml("Նոր հաղորդագրություն կայքի չատում", [
      `${who}${t.email && t.name ? ` (${t.email})` : ""} գրել է՝`,
      body.slice(0, 600),
      ...(t.page ? [`Էջ՝ ${t.page}`] : []),
    ], { label: "Պատասխանել", url: `${siteUrl()}/admin/chats/${t.id}` }));
  } catch (e) { console.error("[chat] notifyAdmin", e); }
}

const replyMail = {
  hy: { subject: "ALTA Academy-ն պատասխանել է Ձեր հարցին", title: "Պատասխան Ձեր հարցին", intro: "Ձեր հարցը կայքի չատում՝", answer: "Մեր պատասխանը՝", cta: "Շարունակել զրույցը" },
  ru: { subject: "ALTA Academy ответила на ваш вопрос", title: "Ответ на ваш вопрос", intro: "Ваш вопрос в чате на сайте:", answer: "Наш ответ:", cta: "Продолжить разговор" },
  en: { subject: "ALTA Academy replied to your question", title: "A reply to your question", intro: "Your question in the site chat:", answer: "Our reply:", cta: "Continue the conversation" },
} as const;

/** Saves the academy's reply; when the visitor has left the site, also sends it to their e-mail. */
export async function adminReply(threadId: string, body: string) {
  const text = body.trim().slice(0, CHAT_MAX_LEN);
  if (!text) return null;
  const [t] = await db.select().from(s.chatThreads).where(eq(s.chatThreads.id, threadId)).limit(1);
  if (!t) return null;
  const now = new Date();
  await db.insert(s.chatMessages).values({ threadId, sender: "admin", body: text });
  await db.update(s.chatThreads).set({ lastMessageAt: now, adminUnread: 0, visitorUnread: sql`${s.chatThreads.visitorUnread} + 1`, status: "open" }).where(eq(s.chatThreads.id, threadId));
  if (t.email || t.userId) await logOutbound({ email: t.email, userId: t.userId }, text, "site"); // CRM timeline + response time
  let emailed = false;
  const away = now.getTime() - t.visitorSeenAt.getTime() > VISITOR_ONLINE_SEC * 1000;
  if (t.email && away) {
    const [lastQ] = await db.select().from(s.chatMessages)
      .where(and(eq(s.chatMessages.threadId, threadId), eq(s.chatMessages.sender, "visitor")))
      .orderBy(sql`${s.chatMessages.createdAt} desc`).limit(1);
    const L = replyMail[(t.locale as keyof typeof replyMail)] ?? replyMail.hy;
    emailed = await sendMail(t.email, L.subject, emailHtml(L.title, [
      ...(lastQ ? [L.intro, lastQ.body.slice(0, 600)] : []), L.answer, text,
    ], { label: L.cta, url: `${siteUrl()}/${t.locale}?chat=1` }));
  }
  return { emailed, away };
}
