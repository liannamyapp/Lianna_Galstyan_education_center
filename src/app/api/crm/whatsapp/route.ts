import { logOutbound, upsertLead } from "@/lib/crm/leads";
import { onNewLead } from "@/lib/crm/automations";

export const dynamic = "force-dynamic";

/**
 * GREEN-API webhook: incoming WhatsApp messages become leads / timeline entries.
 * Setup (GREEN-API console → instance settings):
 *   Webhook URL:   https://YOUR-SITE/api/crm/whatsapp
 *   Webhook token: the value of GREEN_API_WEBHOOK_TOKEN  (sent as "Authorization: Bearer <token>")
 *   Enable "Receive webhooks on incoming messages" and "...on messages sent from the phone"
 *   (then your replies from the phone also appear in the CRM timeline).
 */
type Hook = {
  typeWebhook?: string;
  senderData?: { chatId?: string; sender?: string; senderName?: string; chatName?: string };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
    fileMessageData?: { caption?: string; downloadUrl?: string };
  };
};

export async function POST(req: Request) {
  const token = process.env.GREEN_API_WEBHOOK_TOKEN;
  if (!token) return new Response("GREEN_API_WEBHOOK_TOKEN is not set", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${token}`) return new Response("Unauthorized", { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Hook;
  const kind = b.typeWebhook;
  // "outgoingAPIMessageReceived" = sent by the CRM itself (already logged) → ignore
  if (kind !== "incomingMessageReceived" && kind !== "outgoingMessageReceived") return Response.json({ ok: true, skipped: kind });
  const chatId = b.senderData?.chatId ?? "";
  if (!chatId.endsWith("@c.us")) return Response.json({ ok: true, skipped: "group" }); // ignore group chats

  const md = b.messageData ?? {};
  const text = md.textMessageData?.textMessage ?? md.extendedTextMessageData?.text ?? md.fileMessageData?.caption
    ?? (md.typeMessage ? `[${md.typeMessage}]${md.fileMessageData?.downloadUrl ? ` ${md.fileMessageData.downloadUrl}` : ""}` : "");

  if (kind === "outgoingMessageReceived") {
    // you replied from the phone: log it on an existing lead, never create one (could be a personal chat)
    const lead = await logOutbound({ phone: chatId.replace("@c.us", "") }, text, "whatsapp");
    return Response.json({ ok: true, logged: Boolean(lead) });
  }
  const { lead, created } = await upsertLead({
    phone: chatId.replace("@c.us", ""), name: b.senderData?.senderName || b.senderData?.chatName || null,
    source: "whatsapp", message: text, channel: "whatsapp",
  });
  if (created) await onNewLead(lead);
  return Response.json({ ok: true, lead: lead.id, created });
}
