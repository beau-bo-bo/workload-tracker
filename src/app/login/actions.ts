"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { getSupabaseClient, type UserRow } from "@/lib/supabase";

export type LoginState = { error: string } | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "กรุณากรอก Username และ Password" };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("login", {
    p_username: username,
    p_password: password,
  });

  if (error) {
    return { error: "เกิดข้อผิดพลาด: " + error.message };
  }

  const user = (data as Pick<UserRow, "id" | "username" | "display_name" | "roles">[])?.[0];
  if (!user) {
    return { error: "Username หรือ Password ไม่ถูกต้อง" };
  }

  await createSession({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    roles: user.roles,
  });

  redirect("/");
}
