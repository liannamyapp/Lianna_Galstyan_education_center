import "server-only";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;
function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Branded HTML e-mail. `lines` are paragraphs; optional call-to-action button. */
export function emailHtml(title: string, lines: string[], cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Arial,'Noto Sans Armenian',sans-serif;color:#1c2433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e0d3">
<tr><td style="background:#0f2440;padding:22px 28px;color:#e3c47c;font-size:18px;font-weight:bold">Լիաննա Գալստյան · Education</td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 14px;color:#0f2440">${esc(title)}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.6">${esc(l)}</p>`).join("")}
${cta ? `<p style="margin:22px 0 0"><a href="${cta.url}" style="background:#16365c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:bold">${esc(cta.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

export const mailEnabled = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

/** Sends an e-mail. Never throws. Returns true when it was handed to the SMTP server. */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    console.info(`[mail:dev] to=${to} subject=${subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
    return true;
  } catch (e) {
    console.error("[mail] failed", e);
    return false;
  }
}
