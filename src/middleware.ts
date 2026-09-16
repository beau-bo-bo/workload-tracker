import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  sessionCookieOptions,
  shouldRenewSession,
  signSession,
  verifySessionDetailed,
} from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionDetailed(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !session.user.roles.includes("admin")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  /*
   * ต่ออายุ session อัตโนมัติเมื่อยังใช้งานอยู่ (เพิ่ม 2026-09-16 ตามที่ผู้ใช้สั่ง
   * "ใช้เบราว์เซอร์เดิม ไม่ต้อง login ใหม่")
   *
   * เดิมอายุ 7 วันนับจากวินาทีที่ login → ต่อให้เข้าใช้ทุกวัน พอครบ 7 วันก็เด้งออกอยู่ดี
   * ตอนนี้ทุกครั้งที่เปิดหน้าใด ๆ ถ้า token เก่ากว่า 1 วันจะเซ็นใบใหม่ให้ นับ 7 วันจากวันนั้น
   * → ใครที่เข้าใช้อย่างน้อยสัปดาห์ละครั้งจะไม่ถูกเด้งออกเลย
   *
   * ⚠️ ผลที่ตามมา: session มีอายุยาวได้ไม่จำกัดตราบใดที่ยังใช้งาน และระบบยัง revoke session ไม่ได้ (งาน B2)
   *    → ถอดสิทธิ์/ลบผู้ใช้แล้วเขายังใช้ต่อได้จนกว่าจะหยุดใช้เกิน 7 วัน ต้องทำ B2 พร้อมงาน LINE Login
   */
  if (shouldRenewSession(session.issuedAtSeconds, Math.floor(Date.now() / 1000))) {
    response.cookies.set(COOKIE_NAME, await signSession(session.user), sessionCookieOptions());
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
