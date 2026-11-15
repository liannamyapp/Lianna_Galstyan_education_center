import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { logActivity, unsubToken } from "@/lib/crm/leads";

export const dynamic = "force-dynamic";

const page = (text: string) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OK</title><body style="font-family:Arial,sans-serif;background:#f6f4ef;color:#1c2433;display:grid;place-items:center;min-height:90vh"><p style="max-width:440px;text-align:center;font-size:17px;line-height:1.6">${text}</p></body>`,
  { headers: { "content-type": "text/html; charset=utf-8" } },
);

/** One-click opt-out from marketing messages (link at the bottom of CRM e-mails). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("l") ?? "";
  if (!id || q.get("t") !== unsubToken(id)) return page("Հղումը սխալ է։ · Ссылка недействительна. · Invalid link.");
  const [l] = await db.update(s.leads).set({ unsubscribed: true, marketingOptIn: false }).where(eq(s.leads.id, id)).returning({ id: s.leads.id });
  if (l) await logActivity(l.id, "system", "Հրաժարվեց գովազդային հաղորդագրություններից");
  return page("Դուք այլևս չեք ստանա գովազդային հաղորդագրություններ։<br>Вы больше не будете получать рекламные сообщения.<br>You will no longer receive marketing messages.");
}
