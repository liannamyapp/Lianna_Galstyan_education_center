import { upsertLead } from "@/lib/crm/leads";
import { onNewLead } from "@/lib/crm/automations";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Telegram bot webhook. Every person who writes to the bot becomes a lead.
 * Deep links tag the source: https://t.me/YOUR_BOT?start=instagram  → source "telegram", utm.campaign "instagram".
 * Setup once (replace values):
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-SITE/api/crm/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
type Update = {
  message?: {
    text?: string; caption?: string;
    chat: { id: number; type: string };
    from?: { first_name?: string; last_name?: string; username?: string; language_code?: string };
    contact?: { phone_number?: string };
  };
};

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return new Response("TELEGRAM_WEBHOOK_SECRET is not set", { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("Unauthorized", { status: 401 });

  const u = (await req.json().catch(() => ({}))) as Update;
  const m = u.message;
  if (!m || m.chat.type !== "private") return Response.json({ ok: true });

  const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") || (m.from?.username ? `@${m.from.username}` : null);
  const lang = m.from?.language_code?.slice(0, 2);
  const text = m.text ?? m.caption ?? (m.contact ? "📞 Կիսվեց հեռախոսահամարով" : "[ֆայլ]");
  const start = text.startsWith("/start") ? text.slice(6).trim() : null;

  const { lead, created } = await upsertLead({
    telegramChatId: String(m.chat.id), telegramUsername: m.from?.username ?? null, name,
    phone: m.contact?.phone_number ?? null,
    locale: lang === "ru" ? "ru" : lang === "en" ? "en" : "hy",
    source: "telegram", utm: start ? { source: "telegram", campaign: start } : { source: "telegram" },
    message: start !== null ? `/start${start ? ` ${start}` : ""}` : text, channel: "telegram",
  });
  if (created) await onNewLead(lead);
  else await notifyAdminWhatsApp(`💬 Telegram · ${lead.name}: ${text.slice(0, 300)}\n${siteUrl()}/admin/crm/leads/${lead.id}`);
  return Response.json({ ok: true });
}
