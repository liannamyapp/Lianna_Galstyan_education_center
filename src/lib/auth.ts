import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "./session";

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(user: { id: string; role: "STUDENT" | "ADMIN"; name: string }) {
  const token = await signSession({ uid: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  // UI hint only (lets public pages stay static); real authorization always uses the signed httpOnly cookie
  (await cookies()).set("lg_ui", user.role === "ADMIN" ? "a" : "s", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
  (await cookies()).delete("lg_ui");
}

/** Verified session of an existing, not-blocked account (a blocked account loses access immediately). */
export async function getSession(): Promise<SessionPayload | null> {
  const sess = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!sess) return null;
  const [u] = await db.select({ blockedAt: s.users.blockedAt }).from(s.users).where(eq(s.users.id, sess.uid)).limit(1);
  return u && !u.blockedAt ? sess : null;
}

export async function getCurrentUser() {
  const sess = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!sess) return null;
  const [u] = await db.select().from(s.users).where(eq(s.users.id, sess.uid)).limit(1);
  return u && !u.blockedAt ? u : null;
}

export async function requireUser(locale = "hy") {
  const u = await getCurrentUser();
  if (!u) redirect(`/${locale}/login`);
  return u;
}

export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN") redirect(`/hy/login?next=/admin`);
  return u;
}
