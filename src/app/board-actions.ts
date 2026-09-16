"use server";

import { getSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  ChecklistItem,
  HistoryEntry,
  Meeting,
  MeetingSubTab,
  MeetingTab,
  Task,
  TaskStatus,
} from "./board-types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: "unauthorized" | "version_conflict" | "unknown" };

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

function mapMeeting(row: MeetingRow): Omit<Meeting, "tasks"> {
  return {
    id: row.id,
    title: row.title,
    timeline: row.timeline ?? undefined,
    tab: row.tab,
    subTab: row.sub_tab,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    version: row.version,
  };
}

function mapTask(row: TaskRow): Task {
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

async function requireUser() {
  return await getSession();
}

export async function createMeetingAction(input: {
  title: string;
  timeline: string;
  tab: MeetingTab;
  subTab: MeetingSubTab;
}): Promise<ActionResult<Omit<Meeting, "tasks">>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("create_meeting", {
      p_user_id: user.id,
      p_title: input.title,
      p_timeline: input.timeline || null,
      p_tab: input.tab,
      p_sub_tab: input.subTab,
    })
    .single<MeetingRow>();
  return toResult(error, data ? mapMeeting(data) : null);
}

export async function archiveMeetingAction(input: { id: string; version: number }): Promise<ActionResult<Omit<Meeting, "tasks">>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("archive_meeting", { p_user_id: user.id, p_id: input.id, p_version: input.version })
    .single<MeetingRow>();
  return toResult(error, data ? mapMeeting(data) : null);
}

export async function updateMeetingDetailsAction(input: {
  id: string;
  version: number;
  title: string;
  timeline: string;
}): Promise<ActionResult<Omit<Meeting, "tasks">>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("update_meeting_details", {
      p_user_id: user.id,
      p_id: input.id,
      p_version: input.version,
      p_title: input.title,
      p_timeline: input.timeline || null,
    })
    .single<MeetingRow>();
  return toResult(error, data ? mapMeeting(data) : null);
}

export async function restoreMeetingAction(input: { id: string }): Promise<ActionResult<Omit<Meeting, "tasks">>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("restore_meeting", { p_user_id: user.id, p_id: input.id })
    .single<MeetingRow>();
  return toResult(error, data ? mapMeeting(data) : null);
}

export async function deleteMeetingForeverAction(input: { id: string; version: number }): Promise<ActionResult<true>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_meeting_forever", {
    p_user_id: user.id,
    p_id: input.id,
    p_version: input.version,
  });
  return toResult(error, true);
}

export async function createTaskAction(input: {
  meetingId: string | null;
  title: string;
  ecmNumber?: string;
  ownerId?: string;
  dueDate?: string;
  urgent: boolean;
  note?: string;
}): Promise<ActionResult<Task>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("create_task", {
      p_user_id: user.id,
      p_meeting_id: input.meetingId,
      p_title: input.title,
      p_ecm_number: input.ecmNumber || null,
      p_owner_id: input.ownerId || null,
      p_due_date: input.dueDate || null,
      p_urgent: input.urgent,
      p_note: input.note || null,
    })
    .single<TaskRow>();
  return toResult(error, data ? mapTask(data) : null);
}

export async function updateTaskDetailsAction(input: {
  id: string;
  title: string;
  ecmNumber?: string;
  ownerId?: string;
  dueDate?: string;
  urgent: boolean;
  note?: string;
  checklist: ChecklistItem[];
  excludedAutoSteps: string[];
  version: number;
}): Promise<ActionResult<Task>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("update_task_details", {
      p_user_id: user.id,
      p_id: input.id,
      p_title: input.title,
      p_ecm_number: input.ecmNumber || null,
      p_owner_id: input.ownerId || null,
      p_due_date: input.dueDate || null,
      p_urgent: input.urgent,
      p_note: input.note || null,
      p_checklist: input.checklist,
      p_excluded_auto_steps: input.excludedAutoSteps,
      p_version: input.version,
    })
    .single<TaskRow>();
  return toResult(error, data ? mapTask(data) : null);
}

export async function deleteTaskAction(input: { id: string; version: number }): Promise<ActionResult<Task>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("delete_task", { p_user_id: user.id, p_id: input.id, p_version: input.version })
    .single<TaskRow>();
  return toResult(error, data ? mapTask(data) : null);
}

export async function restoreTaskAction(input: { id: string }): Promise<ActionResult<Task>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("restore_task", { p_user_id: user.id, p_id: input.id })
    .single<TaskRow>();
  return toResult(error, data ? mapTask(data) : null);
}

export async function deleteTaskForeverAction(input: { id: string; version: number }): Promise<ActionResult<true>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_task_forever", {
    p_user_id: user.id,
    p_id: input.id,
    p_version: input.version,
  });
  return toResult(error, true);
}

export async function updateTaskWorkflowAction(input: {
  id: string;
  version: number;
  status: TaskStatus;
  inspectorId?: string;
  history: HistoryEntry[];
}): Promise<ActionResult<Task>> {
  const user = await requireUser();
  if (!user) return UNAUTHORIZED;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("update_task_workflow", {
      p_user_id: user.id,
      p_id: input.id,
      p_version: input.version,
      p_status: input.status,
      p_inspector_id: input.inspectorId || null,
      p_history: input.history,
    })
    .single<TaskRow>();
  return toResult(error, data ? mapTask(data) : null);
}

export async function setDashboardOrderAction(userIds: string[]): Promise<ActionResult<true>> {
  const user = await requireUser();
  if (!user || !user.roles.includes("admin")) return UNAUTHORIZED;
  if (userIds.length === 0) return { ok: false, error: "unknown" };
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_set_dashboard_order", {
    p_admin_id: user.id,
    p_user_ids: userIds,
  });
  return toResult(error, true);
}
