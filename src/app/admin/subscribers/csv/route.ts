import { desc } from "drizzle-orm";
import { db, s } from "@/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const sess = await getSession();
  if (sess?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const list = await db.select().from(s.subscribers).orderBy(desc(s.subscribers.createdAt));
  const csv = ["email,locale,created_at", ...list.map((x) => `${x.email},${x.locale},${x.createdAt.toISOString()}`)].join("\n");
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=subscribers.csv" } });
}
