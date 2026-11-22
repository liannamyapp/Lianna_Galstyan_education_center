import { and, count, eq, isNull } from "drizzle-orm";
import { db, s } from "@/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/me — how many unread notifications the signed-in learner has (for the header badge). */
export async function GET() {
  const sess = await getSession().catch(() => null);
  if (!sess) return Response.json({ unread: 0 }, { headers: { "Cache-Control": "no-store" } });
  const [r] = await db.select({ n: count() }).from(s.notifications).where(and(eq(s.notifications.userId, sess.uid), isNull(s.notifications.readAt)));
  return Response.json({ unread: Number(r?.n ?? 0) }, { headers: { "Cache-Control": "no-store" } });
}
