import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { upsertLead } from "@/lib/crm/leads";
import { onNewLead } from "@/lib/crm/automations";
import { SOURCES } from "@/lib/crm/constants";

export const dynamic = "force-dynamic";

/**
 * Universal lead intake for outside tools: Facebook/Instagram Lead Ads (via Zapier / Make),
 * Google Forms, Tilda/Taplink pages, partner sites, etc.
 *   POST /api/crm/lead   Header: x-crm-key: <CRM_API_KEY>
 *   JSON: { name, phone?, email?, source?, course?: "ՖՎԾ-01", message?, utm_source?, utm_medium?, utm_campaign?, tags?: [] }
 */
export async function POST(req: Request) {
  const key = process.env.CRM_API_KEY;
  if (!key) return new Response("CRM_API_KEY is not set", { status: 503 });
  if (req.headers.get("x-crm-key") !== key) return new Response("Unauthorized", { status: 401 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof b?.[k] === "string" ? (b[k] as string).trim().slice(0, 500) : "");
  if (!b || (!str("phone") && !str("email"))) return Response.json({ ok: false, error: "phone or email is required" }, { status: 400 });

  const code = str("course").toUpperCase();
  const course = code ? (await db.select({ id: s.courses.id }).from(s.courses).where(eq(s.courses.code, code)).limit(1))[0] : undefined;
  const source = (SOURCES as readonly string[]).includes(str("source")) ? str("source") : "site_form";

  const { lead, created } = await upsertLead({
    name: str("name") || null, phone: str("phone") || null, email: str("email") || null,
    locale: str("locale") || "hy", source, courseId: course?.id ?? null,
    utm: { source: str("utm_source") || undefined, medium: str("utm_medium") || undefined, campaign: str("utm_campaign") || undefined },
    tags: Array.isArray(b.tags) ? (b.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 10) : [],
    message: str("message") || null, channel: "site",
  });
  if (created) await onNewLead(lead);
  return Response.json({ ok: true, id: lead.id, created });
}
