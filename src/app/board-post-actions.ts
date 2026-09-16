"use server";

import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { BoardComment, BoardPost, BoardPostInput } from "./board-types";
import type { ActionResult } from "./board-actions";

type BoardPostRow = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  reminder_date: string | null;
  unread: boolean;
  tagged_user_ids: string[];
  tagged_names: string[] | null;
  comments: BoardComment[];
  version: number;
  created_at: string;
};

function mapBoardPost(row: BoardPostRow): BoardPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    reminderDate: row.reminder_date ?? undefined,
    unread: row.unread,
    taggedUserIds: row.tagged_user_ids ?? [],
    taggedNames: row.tagged_names ?? [],
    comments: row.comments ?? [],
    version: row.version,
    createdAt: row.created_at,
  };
}

function toResult<T>(error: { message: string } | null, data: T | null | undefined): ActionResult<T> {
  if (error) {
    if (error.message.includes("version_conflict")) return { ok: false, error: "version_conflict" };
    if (error.message.includes("unauthorized")) return { ok: false, error: "unauthorized" };
    return { ok: false, error: "unknown" };
  }
  if (data === null || data === undefined) return { ok: false, error: "unknown" };
  return { ok: true, data };
}

const UNAUTHORIZED = { ok: false, error: "unauthorized" } as const;

export async function createBoardPostAction(input: BoardPostInput): Promise<ActionResult<BoardPost>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("create_board_post", {
      p_user_id: user.id,
      p_body: input.body,
      p_reminder_date: input.reminderDate || null,
      p_tagged_user_ids: input.taggedUserIds,
    })
    .single<BoardPostRow>();
  return toResult(error, data ? mapBoardPost(data) : null);
}

/**
 * บันทึกว่าผู้ใช้เปิดดู The Wall แล้ว → Red Badge ของทุกโพสต์ที่ tag เขาไว้กลับเป็นศูนย์
 *
 * เรียกครั้งเดียวตอนกดเข้าหน้า The Wall เท่านั้น (ไม่ใช่ตอนกดที่การ์ดทีละใบ)
 * เพราะเนื้อความของ memo ถูกแสดงเต็มอยู่บนการ์ดอยู่แล้ว การเปิดหน้า = ได้เห็นจริง
 */
export async function markWallSeenAction(): Promise<ActionResult<number>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("mark_board_posts_seen", { p_user_id: user.id });
  return toResult(error, (data as number | null) ?? 0);
}

export async function addBoardCommentAction(input: {
  postId: string;
  body: string;
  version: number;
}): Promise<ActionResult<BoardPost>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("add_board_comment", {
      p_user_id: user.id,
      p_post_id: input.postId,
      p_body: input.body,
      p_version: input.version,
    })
    .single<BoardPostRow>();
  return toResult(error, data ? mapBoardPost(data) : null);
}

export async function updateBoardPostAction(input: {
  id: string;
  version: number;
  body: string;
  reminderDate?: string;
  taggedUserIds: string[];
}): Promise<ActionResult<BoardPost>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("update_board_post", {
      p_user_id: user.id,
      p_id: input.id,
      p_body: input.body,
      p_reminder_date: input.reminderDate || null,
      p_tagged_user_ids: input.taggedUserIds,
      p_version: input.version,
    })
    .single<BoardPostRow>();
  return toResult(error, data ? mapBoardPost(data) : null);
}

export async function deleteBoardCommentAction(input: {
  postId: string;
  commentId: string;
  version: number;
}): Promise<ActionResult<BoardPost>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("delete_board_comment", {
      p_user_id: user.id,
      p_post_id: input.postId,
      p_comment_id: input.commentId,
      p_version: input.version,
    })
    .single<BoardPostRow>();
  return toResult(error, data ? mapBoardPost(data) : null);
}

export async function deleteBoardPostAction(input: { id: string; version: number }): Promise<ActionResult<BoardPost>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("delete_board_post", { p_user_id: user.id, p_id: input.id, p_version: input.version })
    .single<BoardPostRow>();
  return toResult(error, data ? mapBoardPost(data) : null);
}

export async function restoreBoardPostAction(input: { id: string }): Promise<ActionResult<BoardPost>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("restore_board_post", { p_user_id: user.id, p_id: input.id })
    .single<BoardPostRow>();
  return toResult(error, data ? mapBoardPost(data) : null);
}

export async function deleteBoardPostForeverAction(input: { id: string; version: number }): Promise<ActionResult<true>> {
  const user = await getSession();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_board_post_forever", {
    p_user_id: user.id,
    p_id: input.id,
    p_version: input.version,
  });
  return toResult(error, true);
}
