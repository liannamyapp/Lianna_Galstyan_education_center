import { runCrmDaily } from "@/lib/crm/automations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily CRM automation (Vercel Cron, see vercel.json): sync with the site, follow-ups, reminders,
 * re-engagement, review requests, auto-close of silent leads, tasks, rescoring and the admin digest.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret ? auth !== `Bearer ${secret}` : process.env.NODE_ENV === "production") return new Response("Unauthorized", { status: 401 });
  const report = await runCrmDaily();
  return Response.json({ ok: true, ...report });
}
