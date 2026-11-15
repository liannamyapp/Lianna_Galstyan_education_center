import "server-only";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { siteUrl } from "@/lib/seo";
import { greenApiUrl } from "@/lib/whatsapp";

/**
 * Webhook secrets. If the env variable is not set, a stable secret is derived from AUTH_SECRET,
 * so the CRM works without any manual configuration (the values are shown to the admin in CRM settings).
 */
export function crmSecret(name: "GREEN_API_WEBHOOK_TOKEN" | "TELEGRAM_WEBHOOK_SECRET" | "META_VERIFY_TOKEN" | "CRM_API_KEY") {
  const v = process.env[name];
  if (v) return v;
  const base = process.env.AUTH_SECRET;
  if (!base) return "";
  return createHmac("sha256", base).update(`crm:${name}`).digest("hex").slice(0, 40);
}

type State = { imported?: string; greenApi?: string; telegram?: string; telegramUsername?: string };

export async function getCrmState(): Promise<State> {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "crm_state")).limit(1).catch(() => []);
  return (row?.value as State) ?? {};
}
async function saveState(patch: State) {
  const v = { ...(await getCrmState()), ...patch };
  await db.insert(s.settings).values({ key: "crm_state", value: v }).onConflictDoUpdate({ target: s.settings.key, set: { value: v } });
  return v;
}

/**
 * Points GREEN-API and the Telegram bot at this site. Idempotent; never overwrites a GREEN-API webhook
 * that belongs to another app (returns "conflict" instead).
 */
export async function ensureWebhooks(force = false) {
  const out: State = {};
  const site = siteUrl();

  const id = process.env.GREEN_API_ID_INSTANCE, token = process.env.GREEN_API_TOKEN;
  if (id && token && site.startsWith("https://")) {
    try {
      const base = `${greenApiUrl()}/waInstance${id}`;
      const cur = (await fetch(`${base}/getSettings/${token}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json())) as { webhookUrl?: string };
      const ours = `${site}/api/crm/whatsapp`;
      if (cur.webhookUrl && cur.webhookUrl !== ours && !force) out.greenApi = `conflict:${cur.webhookUrl}`;
      else {
        const r = await fetch(`${base}/setSettings/${token}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ webhookUrl: ours, webhookUrlToken: crmSecret("GREEN_API_WEBHOOK_TOKEN"), incomingWebhook: "yes", outgoingMessageWebhook: "yes", outgoingAPIMessageWebhook: "no" }),
        });
        out.greenApi = r.ok ? "ok" : `error:${r.status}`;
      }
    } catch (e) { out.greenApi = `error:${(e as Error).message}`; }
  }

  const bot = process.env.TELEGRAM_BOT_TOKEN;
  if (bot && site.startsWith("https://")) {
    try {
      const api = `https://api.telegram.org/bot${bot}`;
      const me = (await fetch(`${api}/getMe`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json())) as { result?: { username?: string } };
      if (me.result?.username) out.telegramUsername = me.result.username;
      const r = await fetch(`${api}/setWebhook`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ url: `${site}/api/crm/telegram`, secret_token: crmSecret("TELEGRAM_WEBHOOK_SECRET"), allowed_updates: ["message"] }),
      });
      out.telegram = r.ok ? "ok" : `error:${r.status}`;
    } catch (e) { out.telegram = `error:${(e as Error).message}`; }
  }
  return saveState(out);
}

/** First visit of the CRM: import the site's existing people (silently) and connect webhooks. */
export async function ensureCrmReady() {
  try {
    const st = await getCrmState();
    if (st.imported) return st;
    const { syncFromSite } = await import("./automations");
    await syncFromSite();
    await saveState({ imported: new Date().toISOString() });
    return await ensureWebhooks();
  } catch (e) {
    console.error("[crm] ensureCrmReady", e);
    return {};
  }
}
