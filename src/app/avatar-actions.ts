"use server";

import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { ActionResult } from "./board-actions";

const UNAUTHORIZED = { ok: false, error: "unauthorized" } as const;

export async function setOwnAvatarAction(variant: number): Promise<ActionResult<number>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("set_own_avatar", { p_user_id: user.id, p_avatar_variant: variant });
  if (error) return { ok: false, error: "unknown" };
  return { ok: true, data: variant };
}
