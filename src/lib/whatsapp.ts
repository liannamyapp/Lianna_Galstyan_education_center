import "server-only";

const cfg = () => ({ id: process.env.GREEN_API_ID_INSTANCE, token: process.env.GREEN_API_TOKEN });
export const whatsappEnabled = () => Boolean(cfg().id && cfg().token);

/** Sends a WhatsApp message via GREEN-API, if configured. Never throws. Returns true on success. */
export async function sendWhatsApp(phone: string | null | undefined, text: string): Promise<boolean> {
  const { id, token } = cfg();
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 9) digits = "374" + digits.slice(1); // 077123456 → 37477123456
  if (!id || !token || digits.length < 10) return false;
  try {
    const r = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${digits}@c.us`, message: text }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch (e) {
    console.error("[whatsapp] failed", e);
    return false;
  }
}

/** Sends a WhatsApp message to the admin (GREEN_API_ADMIN_PHONE). */
export async function notifyAdminWhatsApp(text: string) {
  await sendWhatsApp(process.env.GREEN_API_ADMIN_PHONE, text);
}
