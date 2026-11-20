import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { getSession } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { logActivity } from "@/lib/crm/leads";
import {
  CHAT_COOKIE, CHAT_MAX_LEN, hashIp, newToken, notifyAdmin, publicMessage, saveContact, threadByToken, tooManyMessages, tooManyThreads,
} from "@/lib/chat";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

/** GET /api/chat?after=<iso> — the visitor's conversation (new messages only when `after` is given). */
export async function GET(req: Request) {
  const t = await threadByToken((await cookies()).get(CHAT_COOKIE)?.value);
  if (!t) return json({ thread: null, messages: [] });
  const afterParam = new URL(req.url).searchParams.get("after");
  const after = afterParam && !Number.isNaN(Date.parse(afterParam)) ? new Date(afterParam) : null;
  const rows = await db.select().from(s.chatMessages)
    .where(after ? and(eq(s.chatMessages.threadId, t.id), gt(s.chatMessages.createdAt, after)) : eq(s.chatMessages.threadId, t.id))
    .orderBy(asc(s.chatMessages.createdAt)).limit(200);
  const open = new URL(req.url).searchParams.get("open") === "1";
  // the widget polls while open: that marks the replies as read and the visitor as present
  await db.update(s.chatThreads).set(open ? { visitorSeenAt: new Date(), visitorUnread: 0 } : { visitorSeenAt: new Date() }).where(eq(s.chatThreads.id, t.id));
  return json({
    thread: { name: t.name, email: t.email, unread: open ? 0 : t.visitorUnread },
    messages: rows.map(publicMessage),
  });
}

/**
 * POST /api/chat  JSON { body?, name?, email?, locale?, page?, website? }
 * Sends a message and/or saves contact details. `website` is a honeypot: people never fill it.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ ok: false, error: "bad_request" }, 400);
  const str = (k: string, max = 300) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  if (str("website")) return json({ ok: true, messages: [] }); // bot
  const body = str("body", CHAT_MAX_LEN + 1);
  if (body.length > CHAT_MAX_LEN) return json({ ok: false, error: "too_long" }, 400);
  const name = str("name", 120) || null, email = str("email", 200) || null;
  if (!body && !name && !email) return json({ ok: false, error: "empty" }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "email" }, 400);

  const jar = await cookies();
  let t = await threadByToken(jar.get(CHAT_COOKIE)?.value);
  if (!t) {
    if (!body) return json({ ok: false, error: "empty" }, 400);
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
    const ipHash = hashIp(ip);
    if (await tooManyThreads(ipHash)) return json({ ok: false, error: "rate" }, 429);
    const locale = isLocale(str("locale")) ? str("locale") : "hy";
    const session = await getSession().catch(() => null);
    const token = newToken();
    const me = session?.uid ? (await db.select({ name: s.users.name, email: s.users.email }).from(s.users).where(eq(s.users.id, session.uid)).limit(1))[0] : undefined;
    [t] = await db.insert(s.chatThreads).values({ token, locale, page: str("page", 300) || null, ipHash, userId: session?.uid ?? null, name: me?.name ?? null, email: me?.email ?? null }).returning();
    jar.set(CHAT_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  } else if (body && (await tooManyMessages(t.id))) {
    return json({ ok: false, error: "rate" }, 429);
  }

  let saved = null as ReturnType<typeof publicMessage> | null;
  if (body) {
    const [m] = await db.insert(s.chatMessages).values({ threadId: t.id, sender: "visitor", body }).returning();
    await db.update(s.chatThreads).set({ lastMessageAt: m.createdAt, visitorSeenAt: new Date(), adminUnread: sql`${s.chatThreads.adminUnread} + 1`, status: "open" }).where(eq(s.chatThreads.id, t.id));
    saved = publicMessage(m);
  }
  const before = t;
  const thread = name || email || (t.email && !t.leadId) ? await saveContact(t, name, email, body || undefined) : t;
  after(async () => {
    if (body) {
      if (before.leadId) await logActivity(before.leadId, "message_in", body, "site").catch(() => {});
      await notifyAdmin(thread as typeof before, body);
    }
  });
  return json({ ok: true, message: saved, thread: { name: thread.name, email: thread.email } });
}
