import "server-only";

import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  BoardComment,
  BoardPost,
  ChecklistItem,
  HistoryEntry,
  Meeting,
  MeetingSubTab,
  MeetingTab,
  Person,
  Task,
  TaskStatus,
} from "./board-types";

/*
 * ตัวโหลดข้อมูลกลางของทุกหน้าจอ (แยกออกมาจาก page.tsx ตอนแตกเป็น route จริง 2026-09-16)
 *
 * ทั้ง 5 หน้าจอ (หน้าหลัก / The Wall / งานของฉัน / Dashboard / ถังขยะ) ใช้ชุดข้อมูลเดียวกันทั้งหมด
 * เพราะ Header ต้องรู้ทุกอย่างอยู่แล้ว (เลขแจ้งเตือนของงานและของ memo อยู่บน Header ทุกหน้า)
 * → เขียนไว้ที่เดียว ทุก route เรียกตัวนี้ ไม่ต้องก๊อป 5 รอบ
 *
 * ⚠️ ถ้าต่อไปจะทำให้แต่ละหน้าดึงเฉพาะที่ตัวเองใช้ (งาน P5/P7 ที่ยังค้าง) ให้แตกฟังก์ชันนี้เป็นชิ้นย่อย
 *    อย่าปล่อยให้แต่ละ route เขียน query เองกระจัดกระจาย
 */

function toPeople(
  rows: { id: string; display_name: string; review_groups: string[] }[] | null
): Person[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    reviewGroups: row.review_groups,
  }));
}

type MeetingRow = {
  id: string;
  title: string;
  timeline: string | null;
  tab: MeetingTab;
  sub_tab: MeetingSubTab;
  is_archived: boolean;
  sort_order: number;
  version: number;
};

type TaskRow = {
  id: string;
  meeting_id: string | null;
  title: string;
  ecm_number: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  inspector_id: string | null;
  urgent: boolean;
  note: string | null;
  history: HistoryEntry[];
  checklist: ChecklistItem[];
  excluded_auto_steps: string[] | null;
  deleted_from_meeting_title?: string | null;
  sort_order: number;
  version: number;
};

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

function toBoardPost(row: BoardPostRow): BoardPost {
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

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    title: row.title,
    ecmNumber: row.ecm_number ?? undefined,
    ownerId: row.owner_id ?? undefined,
    dueDate: row.due_date ?? undefined,
    status: row.status,
    inspectorId: row.inspector_id ?? undefined,
    urgent: row.urgent,
    note: row.note ?? undefined,
    history: row.history ?? [],
    checklist: row.checklist ?? [],
    excludedAutoSteps: row.excluded_auto_steps ?? [],
    deletedFromMeetingTitle: row.deleted_from_meeting_title ?? undefined,
    sortOrder: row.sort_order,
    version: row.version,
  };
}

export type AppData = {
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  owners: Person[];
  inspectors: Person[];
  workloadPeople: Person[];
  allUsers: Person[];
  initialMeetings: Meeting[];
  initialOtherTasks: Task[];
  initialDeletedTasks: Task[];
  initialBoardPosts: BoardPost[];
  initialDeletedBoardPosts: BoardPost[];
  canManageTasks: boolean;
  initialAvatarVariant: number | null;
};

/** คืน null เมื่อยังไม่ได้ login — ให้ฝั่ง route เป็นคน redirect เอง (หน้าเว็บต้องป้องกันตัวเอง ไม่พึ่ง middleware อย่างเดียว) */
export async function loadAppData(): Promise<AppData | null> {
  const user = await getSession();
  if (!user) return null;

  const supabase = getSupabaseClient();

  // หน้าถังขยะเปิดให้เฉพาะ admin — เดิมดึงข้อมูลถังขยะมาให้ "ทุกคน" แล้วค่อยซ่อนด้วย UI
  // ซึ่งแปลว่าบันทึกของคนอื่นถูกส่งไปถึงเบราว์เซอร์ของทุกคนจริง ๆ (เปิด DevTools ก็อ่านได้)
  // ตอนนี้ไม่ใช่ admin ก็ไม่ดึงเลย และฝั่งฐานข้อมูลก็ตรวจซ้ำอีกชั้น (ดู 0003_fix_missing_auth_checks.sql)
  const isAdmin = user.roles.includes("admin");
  const emptyRows = Promise.resolve({ data: [] as unknown[] });

  const [
    { data: ownerRows },
    { data: inspectorRows },
    { data: workloadPeopleRows },
    { data: allUserRows },
    { data: meetingRows },
    { data: activeTaskRows },
    { data: deletedTaskRows },
    { data: permissionRows },
    { data: boardPostRows },
    { data: deletedBoardPostRows },
  ] = await Promise.all([
    supabase.rpc("list_users_by_role", { p_role: "owner" }),
    supabase.rpc("list_users_by_role", { p_role: "inspector" }),
    supabase.rpc("list_workload_people"),
    supabase.rpc("list_all_users"),
    supabase.rpc("list_meetings"),
    supabase.rpc("list_active_tasks"),
    isAdmin ? supabase.rpc("list_deleted_tasks") : emptyRows,
    supabase.rpc("get_own_permissions", { p_user_id: user.id }),
    supabase.rpc("list_board_posts", { p_user_id: user.id }),
    isAdmin ? supabase.rpc("list_deleted_board_posts", { p_user_id: user.id }) : emptyRows,
  ]);

  const owners = toPeople(ownerRows);
  const inspectors = toPeople(inspectorRows);
  const workloadPeople: Person[] = ((workloadPeopleRows ?? []) as { id: string; display_name: string }[]).map(
    (row) => ({ id: row.id, displayName: row.display_name })
  );
  const activeTasks = ((activeTaskRows ?? []) as TaskRow[]).map(toTask);
  const deletedTasks = ((deletedTaskRows ?? []) as TaskRow[]).map(toTask);

  const meetings: Meeting[] = ((meetingRows ?? []) as MeetingRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    timeline: row.timeline ?? undefined,
    tab: row.tab,
    subTab: row.sub_tab,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    version: row.version,
    tasks: activeTasks.filter((t) => t.meetingId === row.id),
  }));

  const otherTasks = activeTasks.filter((t) => t.meetingId === null);
  const permissionRow = (permissionRows as { can_manage_tasks: boolean; avatar_variant: number | null }[] | null)?.[0];
  const allUsers: Person[] = ((allUserRows ?? []) as { id: string; display_name: string }[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
  }));

  return {
    user,
    owners,
    inspectors,
    workloadPeople,
    allUsers,
    initialMeetings: meetings,
    initialOtherTasks: otherTasks,
    initialDeletedTasks: deletedTasks,
    initialBoardPosts: ((boardPostRows ?? []) as BoardPostRow[]).map(toBoardPost),
    initialDeletedBoardPosts: ((deletedBoardPostRows ?? []) as BoardPostRow[]).map(toBoardPost),
    canManageTasks: permissionRow?.can_manage_tasks ?? true,
    initialAvatarVariant: permissionRow?.avatar_variant ?? null,
  };
}
