import { SignJWT, jwtVerify } from "jose";

export type Role = "admin" | "owner" | "inspector";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  roles: Role[];
};

export const COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

/**
 * ต่ออายุ session ให้เมื่อ token ที่ถืออยู่เก่ากว่านี้ (1 วัน)
 *
 * ทำไมไม่ต่อทุก request: การเซ็น token ใหม่มีต้นทุน และ set-cookie ทุกครั้งก็เปลืองเปล่า ๆ
 * ทำไมไม่รอจนใกล้หมดอายุค่อยต่อ: ถ้ารอถึงวันที่ 6 แล้วคนนั้นบังเอิญไม่ได้เข้าใช้ช่วงนั้นพอดี เขาจะหลุดทั้งที่ใช้งานอยู่ประจำ
 */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

/**
 * ค่าคุกกี้ session ที่ใช้ร่วมกันทั้งตอน login และตอนต่ออายุใน middleware
 * ⚠️ ต้องเป็นชุดเดียวกันเป๊ะ ๆ ไม่งั้นการต่ออายุจะเขียนคุกกี้คนละใบกับตอน login
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // ระบบนี้เคยเข้าผ่าน http://<LAN IP> ซึ่งไม่ได้เข้ารหัส — ถ้าตั้ง secure ตาม NODE_ENV
    // พอ build เป็น production เบราว์เซอร์จะไม่ยอมเก็บคุกกี้เลย ทำให้ login วนกลับหน้าเดิมไม่รู้จบ
    // (บั๊กนี้ไม่โผล่ตอน dev จึงหาสาเหตุยากมาก) — บน Vercel (https) ตั้ง APP_SECURE_COOKIES=true
    secure: process.env.APP_SECURE_COOKIES === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

/**
 * ถึงเวลาต่ออายุ session แล้วหรือยัง — แยกออกมาเป็นฟังก์ชันล้วน ๆ เพื่อเขียน test ได้
 * (เวลาเป็นหน่วยวินาทีแบบเดียวกับ `iat` ใน JWT)
 */
export function shouldRenewSession(issuedAtSeconds: number, nowSeconds: number): boolean {
  if (!Number.isFinite(issuedAtSeconds) || issuedAtSeconds <= 0) return false;
  return nowSeconds - issuedAtSeconds >= SESSION_RENEW_AFTER_SECONDS;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET environment variable");
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export type VerifiedSession = {
  user: SessionUser;
  /** เวลาที่ token ใบนี้ถูกเซ็น (วินาที) ใช้ตัดสินว่าถึงเวลาต่ออายุหรือยัง */
  issuedAtSeconds: number;
};

export async function verifySessionDetailed(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      user: {
        id: payload.id as string,
        username: payload.username as string,
        displayName: payload.displayName as string,
        roles: payload.roles as Role[],
      },
      issuedAtSeconds: typeof payload.iat === "number" ? payload.iat : 0,
    };
  } catch {
    return null;
  }
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  return (await verifySessionDetailed(token))?.user ?? null;
}
