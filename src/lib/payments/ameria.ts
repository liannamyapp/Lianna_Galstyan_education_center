/** Ameriabank vPOS 3.1 (bank cards: ArCa, Visa, Mastercard). */
const base = () => (process.env.AMERIA_TEST === "false" ? "https://services.ameriabank.am/VPOS" : "https://servicestest.ameriabank.am/VPOS");
export const ameriaEnabled = () => !!(process.env.AMERIA_CLIENT_ID && process.env.AMERIA_USERNAME && process.env.AMERIA_PASSWORD);

export async function ameriaInit(p: { orderNo: number; amount: number; description: string; backUrl: string; locale: string }) {
  const res = await fetch(`${base()}/api/VPOS/InitPayment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ClientID: process.env.AMERIA_CLIENT_ID,
      Username: process.env.AMERIA_USERNAME,
      Password: process.env.AMERIA_PASSWORD,
      Currency: "051",
      Description: p.description.slice(0, 120),
      OrderID: p.orderNo,
      Amount: p.amount,
      BackURL: p.backUrl,
      Opaque: String(p.orderNo),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json()) as { PaymentID?: string; ResponseCode?: number; ResponseMessage?: string };
  if (data.ResponseCode !== 1 || !data.PaymentID) throw new Error(`Ameria init failed: ${data.ResponseMessage ?? res.status}`);
  const lang = p.locale === "ru" ? "ru" : p.locale === "en" ? "en" : "am";
  return { paymentId: data.PaymentID, redirectUrl: `${base()}/Payments/Pay?id=${data.PaymentID}&lang=${lang}` };
}

export async function ameriaDetails(paymentId: string) {
  const res = await fetch(`${base()}/api/VPOS/GetPaymentDetails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ PaymentID: paymentId, Username: process.env.AMERIA_USERNAME, Password: process.env.AMERIA_PASSWORD }),
    signal: AbortSignal.timeout(15000),
  });
  return (await res.json()) as { ResponseCode?: string; PaymentState?: string; Amount?: number; OrderID?: string; [k: string]: unknown };
}
