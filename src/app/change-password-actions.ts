"use server";

import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export type ChangePasswordState = { error?: string; success?: string } | null;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await getSession();
  if (!user) {
    return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }
  if (newPassword.length < 6) {
    return { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" };
  }
  if (newPassword !== confirmPassword) {
    return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("change_own_password", {
    p_user_id: user.id,
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });

  if (error) {
    if (error.message.includes("invalid_current_password")) {
      return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  return { success: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
}
