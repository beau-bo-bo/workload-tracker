import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

/*
 * เครื่องมือวัดความเร็วชั่วคราว (2026-09-16) — ใช้หาว่าเวลาที่หายไปตอนเปลี่ยนหน้าบน Vercel อยู่ตรงไหน
 * คืนแต่ "ตัวเลขเวลา" ไม่คืนข้อมูลในระบบสักแถวเดียว และต้อง login ก่อนถึงเรียกได้
 *
 * ⚠️ ถ้าเจอไฟล์นี้ค้างอยู่หลังจากแก้เรื่องความเร็วเสร็จแล้ว ให้ลบทิ้งได้เลย
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const bootedAt = Date.now();
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();

  async function timed(label: string, run: () => PromiseLike<unknown>) {
    const t0 = Date.now();
    await run();
    return { label, ms: Date.now() - t0 };
  }

  const t0 = Date.now();
  const parallel = await Promise.all([
    timed("list_users_by_role(owner)", () => supabase.rpc("list_users_by_role", { p_role: "owner" })),
    timed("list_users_by_role(inspector)", () => supabase.rpc("list_users_by_role", { p_role: "inspector" })),
    timed("list_workload_people", () => supabase.rpc("list_workload_people")),
    timed("list_all_users", () => supabase.rpc("list_all_users")),
    timed("list_meetings", () => supabase.rpc("list_meetings")),
    timed("list_active_tasks", () => supabase.rpc("list_active_tasks")),
    timed("get_own_permissions", () => supabase.rpc("get_own_permissions", { p_user_id: user.id })),
    timed("list_board_posts", () => supabase.rpc("list_board_posts", { p_user_id: user.id })),
  ]);
  const allRpcMs = Date.now() - t0;

  // เรียกซ้ำอีกรอบตอนที่การเชื่อมต่ออุ่นแล้ว เพื่อแยก "ครั้งแรกช้าเพราะเพิ่งต่อ" ออกจาก "ช้าตลอด"
  const t1 = Date.now();
  await supabase.rpc("list_meetings");
  const warmSingleMs = Date.now() - t1;

  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? "local",
    "ตรวจ session เสร็จภายใน (ms)": t0 - bootedAt,
    "เรียกฐานข้อมูล 8 คำสั่งพร้อมกัน (ms)": allRpcMs,
    "เรียกซ้ำคำสั่งเดียวตอนอุ่นแล้ว (ms)": warmSingleMs,
    รายตัว: parallel.sort((a, b) => b.ms - a.ms),
  });
}
