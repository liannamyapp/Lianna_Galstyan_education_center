"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { markFailed, markPaid, testPaymentsAllowed } from "@/lib/payments";

export async function simulateAction(fd: FormData) {
  const locale = String(fd.get("locale") || "hy");
  const id = String(fd.get("id"));
  const user = await getCurrentUser(); // role from the database, not from the cookie
  if (!user || !testPaymentsAllowed(user.role)) redirect(`/${locale}`);
  const sess = { uid: user.id };
  const [p] = await db.select().from(s.payments).where(and(eq(s.payments.id, id), eq(s.payments.userId, sess.uid))).limit(1);
  if (p && p.status === "PENDING") {
    await db.update(s.payments).set({ method: "TEST" }).where(eq(s.payments.id, p.id));
    if (fd.get("result") === "ok") await markPaid(p.id, `TEST-${Date.now()}`);
    else await markFailed(p.id);
  }
  redirect(`/${locale}/pay/result?id=${id}`);
}
