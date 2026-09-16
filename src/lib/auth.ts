import { cookies } from "next/headers";
import { COOKIE_NAME, sessionCookieOptions, signSession, verifySession, type SessionUser } from "./session";

export type { SessionUser };

export async function createSession(user: SessionUser) {
  const token = await signSession(user);
  const cookieStore = await cookies();
  // ใช้ค่าชุดเดียวกับตอนที่ middleware ต่ออายุ session ให้ (ดู sessionCookieOptions ใน session.ts)
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions());
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
