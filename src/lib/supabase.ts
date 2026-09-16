import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * ตัวเชื่อมฐานข้อมูล — ใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * เดิมใช้ NEXT_PUBLIC_SUPABASE_ANON_KEY ซึ่งเป็นปัญหาใหญ่ 2 ชั้น:
 *   1. ตัวแปรที่ขึ้นต้นด้วย NEXT_PUBLIC_ จะถูกฝังลงไฟล์ JavaScript ที่ส่งให้เบราว์เซอร์ทุกคน
 *      → เท่ากับแจกกุญแจให้ทุกคนที่เปิด DevTools
 *   2. role `anon` มีสิทธิ์เรียกฟังก์ชันทั้งหมดได้ตรง ๆ โดยไม่ต้อง login (ดู 0004_lockdown_rpc_grants.sql)
 *
 * ตอนนี้ใช้ service_role key ซึ่งไม่มี prefix NEXT_PUBLIC_ จึงไม่ถูกส่งไปกับหน้าเว็บ
 * และ `import "server-only"` จะทำให้ build พังทันทีถ้ามีไฟล์ฝั่ง client เผลอ import เข้ามา
 *
 * ⚠️ service_role ข้ามทุกด่านตรวจของฐานข้อมูล — ทุกจุดที่เรียกใช้ต้องตรวจสิทธิ์ผู้ใช้เองก่อนเสมอ
 *    (ดู getSession() ใน lib/auth.ts และ requireAdmin() ใน admin/users/actions.ts)
 */
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "ไม่พบ SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local (ดูตัวอย่างที่ .env.local.example)"
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Role = "admin" | "owner" | "inspector";

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  roles: Role[];
  created_at: string;
  review_groups: string[];
  can_manage_tasks: boolean;
};
