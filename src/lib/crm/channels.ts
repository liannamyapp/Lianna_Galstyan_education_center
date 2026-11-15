import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, s } from "@/db";
import { emailHtml, mailEnabled, sendMail } from "@/lib/mail";
import { sendWhatsApp, whatsappEnabled } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/seo";
import { logActivity, unsubToken, type Lead } from "./leads";
import type { Channel } from "./constants";

const env = (k: string) => process.env[k] || "";
const GRAPH = "https://graph.facebook.com/v21.0";

/** Which channels are configured on the server (env variables present). */
export function channelStatus(): Record<Channel, boolean> {
  return {
    whatsapp: whatsappEnabled(),
    telegram: Boolean(env("TELEGRAM_BOT_TOKEN")),
    email: mailEnabled(),
    instagram: Boolean(env("META_PAGE_TOKEN")),
    facebook: Boolean(env("META_PAGE_TOKEN")),
  };
}

/**
 * Instagram and Messenger only allow free-form messages within 24 hours of the person's last message
 * (Meta "standard messaging window"). Outside the window we fall back to other channels.
 */
export const metaWindowOpen = (l: Pick<Lead, "lastInboundAt">) =>
  Boolean(l.lastInboundAt && Date.now() - new Date(l.lastInboundAt).getTime() < 23.5 * 3_600_000);

/** Channels through which this lead can be reached right now. */
export function reachable(l: Lead): Channel[] {
  const on = channelStatus();
  const out: Channel[] = [];
  if (on.whatsapp && l.phone) out.push("whatsapp");
  if (on.telegram && l.telegramChatId) out.push("telegram");
  if (on.instagram && l.instagramId && metaWindowOpen(l)) out.push("instagram");
  if (on.facebook && l.facebookId && metaWindowOpen(l)) out.push("facebook");
  if (on.email && l.email) out.push("email");
  return out;
}

/** Best channel: the one they last wrote from, otherwise messengers before e-mail. */
export async function bestChannel(l: Lead): Promise<Channel | null> {
  const can = reachable(l);
  if (!can.length) return null;
  const [last] = await db.select({ channel: s.leadActivities.channel }).from(s.leadActivities)
    .where(and(eq(s.leadActivities.leadId, l.id), eq(s.leadActivities.type, "message_in"), isNotNull(s.leadActivities.channel)))
    .orderBy(desc(s.leadActivities.createdAt)).limit(1);
  if (last?.channel && can.includes(last.channel as Channel)) return last.channel as Channel;
  return can[0];
}

async function sendTelegram(chatId: string, text: string) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch (e) { console.error("[telegram]", e); return false; }
}

async function sendMeta(recipientId: string, text: string) {
  try {
    const r = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(env("META_PAGE_TOKEN"))}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 1990) }, messaging_type: "RESPONSE" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error("[meta]", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) { console.error("[meta]", e); return false; }
}

export type SendResult = { ok: boolean; channel: Channel | null; error?: string };

/**
 * Sends a message to a lead on the given channel ("auto" = best available) and logs it in the timeline.
 * `marketing: true` adds an unsubscribe link and is skipped for leads who opted out.
 */
export async function sendToLead(
  lead: Lead,
  channel: Channel | "auto",
  msg: { text: string; subject?: string; marketing?: boolean; key?: string },
): Promise<SendResult> {
  if (msg.marketing && (lead.unsubscribed || !lead.marketingOptIn)) return { ok: false, channel: null, error: "Լիդը հրաժարվել է հաղորդագրություններից" };
  const ch = channel === "auto" ? await bestChannel(lead) : channel;
  if (!ch) return { ok: false, channel: null, error: "Կապի հասանելի ալիք չկա" };
  if (!reachable(lead).includes(ch)) return { ok: false, channel: ch, error: ch === "instagram" || ch === "facebook" ? "Meta-ի 24-ժամյա պատուհանը փակ է կամ ալիքը միացված չէ" : "Այս ալիքով կապ չկա" };

  let ok = false;
  const unsub = `${siteUrl()}/api/crm/unsubscribe?l=${lead.id}&t=${unsubToken(lead.id)}`;
  if (ch === "whatsapp") ok = await sendWhatsApp(lead.phone, msg.text);
  else if (ch === "telegram") ok = await sendTelegram(lead.telegramChatId!, msg.text);
  else if (ch === "instagram") ok = await sendMeta(lead.instagramId!, msg.text);
  else if (ch === "facebook") ok = await sendMeta(lead.facebookId!, msg.text);
  else if (ch === "email") {
    const lines = msg.text.split("\n").filter(Boolean);
    if (msg.marketing) lines.push(`—`, `Չեք ցանկանում ստանալ նման նամակներ․ ${unsub}`);
    ok = (await sendMail(lead.email!, msg.subject || lines[0].slice(0, 80), emailHtml(msg.subject || "", lines)));
  }

  await logActivity(lead.id, "message_out", msg.text, ch, { ok, key: msg.key ?? null, subject: msg.subject ?? null });
  if (ok) {
    const now = new Date();
    await db.update(s.leads).set({ lastContactAt: now, ...(lead.firstResponseAt ? {} : { firstResponseAt: now }) }).where(eq(s.leads.id, lead.id));
  }
  return ok ? { ok, channel: ch } : { ok, channel: ch, error: "Ուղարկումը չհաջողվեց (ստուգեք ալիքի կարգավորումները)" };
}

/** Telegram deep link that opens the bot and tags the lead's source, e.g. t.me/bot?start=instagram */
export const telegramStartLink = (payload = "site") => (env("TELEGRAM_BOT_USERNAME") ? `https://t.me/${env("TELEGRAM_BOT_USERNAME")}?start=${encodeURIComponent(payload)}` : "");
