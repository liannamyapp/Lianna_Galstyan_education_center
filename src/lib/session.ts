import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "lg_session";
export type SessionPayload = { uid: string; role: "STUDENT" | "ADMIN"; name: string };

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (16+ chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT(p).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
