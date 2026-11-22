import "server-only";
import { db, s } from "@/db";
import { emailHtml, sendMail } from "@/lib/mail";

type Who = { id: string; email: string; name?: string | null };

/**
 * Tells a learner about something the academy did: saves it to the account's notification list
 * and sends the same text by e-mail. Never throws.
 * `lines` are paragraphs; the greeting with the learner's name is added automatically when `greet` is set.
 */
export async function notifyStudent(user: Who, title: string, lines: string[], cta?: { label: string; url: string }, opts: { greet?: boolean; email?: boolean } = {}) {
  const body = lines.filter(Boolean);
  try {
    await db.insert(s.notifications).values({ userId: user.id, title, body: body.join("\n"), url: cta?.url ?? null });
  } catch (e) { console.error("[notify] save", e); }
  if (opts.email === false) return true;
  const paras = opts.greet !== false && user.name ? [`${user.name},`, ...body] : body;
  return sendMail(user.email, title, emailHtml(title, paras, cta));
}
