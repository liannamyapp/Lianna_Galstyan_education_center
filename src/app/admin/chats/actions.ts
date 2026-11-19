"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { str } from "@/lib/validate";
import { adminReply } from "@/lib/chat";
import type { ActionResult } from "@/components/ActionForm";

export async function replyChat(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id"), body = str(fd, "body");
    if (body.length < 1) return { error: "Գրեք պատասխանը" };
    const r = await adminReply(id, body);
    if (!r) return { error: "Զրույցը չի գտնվել" };
    revalidatePath(`/admin/chats/${id}`);
    revalidatePath("/admin/chats");
    return { ok: true, message: r.emailed ? "Ուղարկված է։ Այցելուն կայքում չէր, ուստի պատասխանը գնաց նաև նրա էլ. փոստին։" : "Ուղարկված է" };
  } catch (e) { return { error: e instanceof Error ? e.message : "Սխալ" }; }
}

export async function setChatStatus(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id"), status = str(fd, "status") === "closed" ? "closed" : "open";
  await db.update(s.chatThreads).set({ status, ...(status === "closed" ? { adminUnread: 0 } : {}) }).where(eq(s.chatThreads.id, id));
  revalidatePath("/admin/chats");
  revalidatePath(`/admin/chats/${id}`);
}

export async function deleteChat(fd: FormData) {
  await requireAdmin();
  await db.delete(s.chatThreads).where(eq(s.chatThreads.id, str(fd, "id")));
  revalidatePath("/admin/chats");
  redirect("/admin/chats");
}
