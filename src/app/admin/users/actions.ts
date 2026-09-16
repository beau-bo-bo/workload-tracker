"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSupabaseClient, type Role } from "@/lib/supabase";
import { REVIEW_GROUPS } from "@/app/board-types";

export type ActionState = { error?: string; success?: string } | null;

async function requireAdmin() {
  const user = await getSession();
  if (!user || !user.roles.includes("admin")) {
    throw new Error("Unauthorized");
  }
  return user;
}

const VALID_ROLES: Role[] = ["admin", "owner", "inspector"];
const VALID_REVIEW_GROUPS = REVIEW_GROUPS.map((g) => g.key as string);

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const roles = formData.getAll("roles").map(String).filter((r): r is Role =>
    VALID_ROLES.includes(r as Role)
  );

  if (!username || !password || !displayName) {
    return { error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }
  if (roles.length === 0) {
    return { error: "กรุณาเลือก Role อย่างน้อย 1 อย่าง" };
  }
  if (password.length < 6) {
    return { error: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_create_user", {
    p_admin_id: admin.id,
    p_username: username,
    p_password: password,
    p_display_name: displayName,
    p_roles: roles,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Username นี้ถูกใช้งานแล้ว" };
    }
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  revalidatePath("/admin/users");
  return { success: `สร้างผู้ใช้งาน "${displayName}" เรียบร้อยแล้ว` };
}

export async function updateUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const roles = formData.getAll("roles").map(String).filter((r): r is Role =>
    VALID_ROLES.includes(r as Role)
  );
  const reviewGroups = formData.getAll("reviewGroups").map(String).filter((g) =>
    VALID_REVIEW_GROUPS.includes(g)
  );
  const canManageTasks = formData.get("canManageTasks") === "on";

  if (!userId || !displayName) {
    return { error: "กรุณากรอกชื่อที่แสดง" };
  }
  if (roles.length === 0) {
    return { error: "กรุณาเลือก Role อย่างน้อย 1 อย่าง" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_update_user", {
    p_admin_id: admin.id,
    p_target_user_id: userId,
    p_display_name: displayName,
    p_roles: roles,
    p_review_groups: reviewGroups,
    p_can_manage_tasks: canManageTasks,
  });

  if (error) {
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  revalidatePath("/admin/users");
  return { success: "บันทึกข้อมูลเรียบร้อยแล้ว" };
}

export async function deleteUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    return { error: "ข้อมูลไม่ครบถ้วน" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_delete_user", {
    p_admin_id: admin.id,
    p_target_user_id: userId,
  });

  if (error) {
    if (error.message.includes("cannot_delete_self")) {
      return { error: "ไม่สามารถลบบัญชีของตัวเองได้" };
    }
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  revalidatePath("/admin/users");
  return { success: "ลบผู้ใช้งานเรียบร้อยแล้ว" };
}

export async function setUserOrderAction(userIds: string[]): Promise<ActionState> {
  const admin = await requireAdmin();

  if (userIds.length === 0) {
    return { error: "ข้อมูลไม่ครบถ้วน" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_set_user_order", {
    p_admin_id: admin.id,
    p_user_ids: userIds,
  });

  if (error) {
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  return { success: "จัดลำดับเรียบร้อยแล้ว" };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!userId || !newPassword) {
    return { error: "ข้อมูลไม่ครบถ้วน" };
  }
  if (newPassword.length < 6) {
    return { error: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_reset_password", {
    p_admin_id: admin.id,
    p_target_user_id: userId,
    p_new_password: newPassword,
  });

  if (error) {
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  revalidatePath("/admin/users");
  return { success: "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว" };
}
