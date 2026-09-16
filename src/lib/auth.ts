import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signSession,
  verifySession,
  type SessionUser,
} from "./session";

export type { SessionUser };

export async function createSession(user: SessionUser) {
  const token = await signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // ระบบนี้เข้าผ่าน http://<LAN IP> ซึ่งไม่ได้เข้ารหัส — ถ้าตั้ง secure ตาม NODE_ENV
    // พอ build เป็น production เบราว์เซอร์จะไม่ยอมเก็บคุกกี้เลย ทำให้ login วนกลับหน้าเดิมไม่รู้จบ
    // (บั๊กนี้ไม่โผล่ตอน dev จึงหาสาเหตุยากมาก)
    // เมื่อย้ายไป HTTPS แล้วให้ตั้ง APP_SECURE_COOKIES=true ใน .env.local
    secure: process.env.APP_SECURE_COOKIES === "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
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
