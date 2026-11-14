import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { ameriaDetails } from "@/lib/payments/ameria";
import { markFailed, markPaid } from "@/lib/payments";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Ameriabank BackURL: verifies the payment server-side before marking it paid. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const locale = ["hy", "ru", "en"].includes(u.searchParams.get("locale") ?? "") ? u.searchParams.get("locale")! : "hy";
  const paymentID = u.searchParams.get("paymentID") || u.searchParams.get("paymentId") || "";
  const orderNo = Number(u.searchParams.get("orderID") || u.searchParams.get("opaque"));
  const [p] = Number.isInteger(orderNo) ? await db.select().from(s.payments).where(eq(s.payments.orderNo, orderNo)).limit(1) : [];
  if (!p) return NextResponse.redirect(`${siteUrl()}/${locale}/account`);
  try {
    const d = await ameriaDetails(paymentID || p.providerRef || "");
    const approved = d.ResponseCode === "00" && (!d.PaymentState || d.PaymentState === "payment_approved" || d.PaymentState === "payment_deposited");
    if (approved && Number(d.Amount) === p.amount) await markPaid(p.id, paymentID, d);
    else if (p.status === "PENDING") await markFailed(p.id, d);
  } catch (e) {
    console.error("[ameria]", e);
  }
  return NextResponse.redirect(`${siteUrl()}/${locale}/pay/result?id=${p.id}`);
}
