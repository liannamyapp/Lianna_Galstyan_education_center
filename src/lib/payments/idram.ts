import { createHash } from "node:crypto";

export const IDRAM_URL = "https://banking.idram.am/Payment/GetPayment";
export const idramEnabled = () => !!(process.env.IDRAM_REC_ACCOUNT && process.env.IDRAM_SECRET_KEY);

export function idramForm(p: { orderNo: number; amount: number; description: string; email?: string; locale: string }) {
  const lang = p.locale === "ru" ? "RU" : p.locale === "en" ? "EN" : "AM";
  return {
    action: IDRAM_URL,
    fields: {
      EDP_LANGUAGE: lang,
      EDP_REC_ACCOUNT: process.env.IDRAM_REC_ACCOUNT!,
      EDP_DESCRIPTION: p.description.slice(0, 120),
      EDP_AMOUNT: String(p.amount),
      EDP_BILL_NO: String(p.orderNo),
      ...(p.email ? { EDP_EMAIL: p.email } : {}),
    },
  };
}

/** Verifies the checksum Idram sends to RESULT_URL after a payment. */
export function idramChecksumOk(f: Record<string, string>) {
  const src = [f.EDP_REC_ACCOUNT, f.EDP_AMOUNT, process.env.IDRAM_SECRET_KEY, f.EDP_BILL_NO, f.EDP_PAYER_ACCOUNT, f.EDP_TRANS_ID, f.EDP_TRANS_DATE].join(":");
  const md5 = createHash("md5").update(src).digest("hex");
  return md5.toUpperCase() === String(f.EDP_CHECKSUM || "").toUpperCase();
}
