import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { idramChecksumOk } from "@/lib/payments/idram";
import { markPaid } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Idram RESULT_URL: handles both the pre-check and the payment confirmation. Must answer "OK". */
export async function POST(req: Request) {
  const form = await req.formData();
  const f = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const orderNo = Number(f.EDP_BILL_NO);
  if (!Number.isInteger(orderNo)) return new Response("BAD_BILL", { status: 400 });
  const [p] = await db.select().from(s.payments).where(eq(s.payments.orderNo, orderNo)).limit(1);
  if (!p) return new Response("NOT_FOUND", { status: 404 });
  if (f.EDP_REC_ACCOUNT !== process.env.IDRAM_REC_ACCOUNT || Number(f.EDP_AMOUNT) !== p.amount) return new Response("MISMATCH", { status: 400 });

  if (f.EDP_PRECHECK === "YES") {
    return new Response(p.status === "PENDING" ? "OK" : "ALREADY_PROCESSED", { headers: { "Content-Type": "text/plain" } });
  }
  if (!idramChecksumOk(f)) return new Response("BAD_CHECKSUM", { status: 400 });
  await markPaid(p.id, f.EDP_TRANS_ID, { payer: f.EDP_PAYER_ACCOUNT, date: f.EDP_TRANS_DATE });
  return new Response("OK", { headers: { "Content-Type": "text/plain" } });
}
