"use server";

import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { ActionResult } from "./board-actions";

const UNAUTHORIZED = { ok: false, error: "unauthorized" } as const;

export type LeaderboardEntry = { displayName: string; seconds: number };

export async function submitMinesweeperScoreAction(seconds: number): Promise<ActionResult<true>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("submit_minesweeper_score", {
    p_user_id: user.id,
    p_seconds: Math.round(seconds),
  });
  if (error) return { ok: false, error: "unknown" };
  return { ok: true, data: true };
}

export async function getDailyLeaderboardAction(): Promise<ActionResult<LeaderboardEntry[]>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_daily_leaderboard");
  if (error) return { ok: false, error: "unknown" };
  const rows = (data ?? []) as { display_name: string; best_seconds: number }[];
  return { ok: true, data: rows.map((row) => ({ displayName: row.display_name, seconds: row.best_seconds })) };
}
