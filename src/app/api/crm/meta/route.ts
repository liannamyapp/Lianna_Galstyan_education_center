import { createHmac, timingSafeEqual } from "node:crypto";
import { upsertLead } from "@/lib/crm/leads";
import { onNewLead } from "@/lib/crm/automations";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Meta webhook for Facebook Messenger and Instagram Direct messages.
 * Setup (developers.facebook.com → your app → Webhooks):
 *   Callback URL: https://YOUR-SITE/api/crm/meta     Verify token: META_VERIFY_TOKEN
 *   Subscribe the Page to "messages" (Messenger) and the Instagram account to "messages".
 * Env: META_APP_SECRET (signature check), META_VERIFY_TOKEN, META_PAGE_TOKEN (to reply and read names).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) return new Response(q.get("hub.challenge") ?? "");
  return new Response("Forbidden", { status: 403 });
}

type Messaging = { sender?: { id: string }; recipient?: { id: string }; message?: { text?: string; is_echo?: boolean; attachments?: { type: string }[] } };
type Body = { object?: string; entry?: { id: string; messaging?: Messaging[] }[] };

function validSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

async function profileName(id: string, instagram: boolean) {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=${instagram ? "name,username" : "first_name,last_name"}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const p = (await r.json()) as { name?: string; username?: string; first_name?: string; last_name?: string };
    return p.name || (p.username ? `@${p.username}` : null) || [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Unauthorized", { status: 401 });
  const body = JSON.parse(raw) as Body;
  const instagram = body.object === "instagram";
  if (body.object !== "page" && !instagram) return Response.json({ ok: true });

  for (const e of body.entry ?? []) {
    for (const m of e.messaging ?? []) {
      if (!m.sender?.id || !m.message || m.message.is_echo || m.sender.id === e.id) continue;
      const text = m.message.text ?? (m.message.attachments?.length ? `[${m.message.attachments.map((a) => a.type).join(", ")}]` : "");
      const id = m.sender.id;
      const { lead, created } = await upsertLead({
        ...(instagram ? { instagramId: id } : { facebookId: id }),
        name: (await profileName(id, instagram)) ?? (instagram ? "Instagram օգտատեր" : "Facebook օգտատեր"),
        source: instagram ? "instagram" : "facebook", message: text, channel: instagram ? "instagram" : "facebook",
      });
      if (created) await onNewLead(lead);
      else await notifyAdminWhatsApp(`💬 ${instagram ? "Instagram" : "Messenger"} · ${lead.name}: ${text.slice(0, 300)}\n${siteUrl()}/admin/crm/leads/${lead.id}`);
    }
  }
  return Response.json({ ok: true });
}
