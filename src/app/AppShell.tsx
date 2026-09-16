"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArchiveBoxIcon, BoardIcon, ChartIcon, ChecklistIcon, KeyIcon, SettingsIcon } from "@/components/icons";
import { AvatarFace, AVATAR_FACE_COUNT } from "@/components/AvatarFace";
import type { SessionUser } from "@/lib/session";
import {
  isInReviewGroup,
  type BoardPost,
  type BoardPostInput,
  type ChecklistItem,
  type Meeting,
  type MeetingSubTab,
  type MeetingTab,
  type Person,
  type Task,
  type TaskInput,
} from "./board-types";
import {
  buildAddNoteTransition,
  buildCloseTransition,
  buildReopenTransition,
  buildReviewTransition,
  buildSendTransition,
  type SkippedReviewChoice,
  type WorkflowPatch,
} from "./task-workflow";
import {
  archiveMeetingAction,
  createMeetingAction,
  createTaskAction,
  deleteMeetingForeverAction,
  deleteTaskAction,
  deleteTaskForeverAction,
  restoreMeetingAction,
  restoreTaskAction,
  updateMeetingDetailsAction,
  updateTaskDetailsAction,
  updateTaskWorkflowAction,
  type ActionResult,
} from "./board-actions";
import {
  addBoardCommentAction,
  createBoardPostAction,
  deleteBoardCommentAction,
  deleteBoardPostAction,
  deleteBoardPostForeverAction,
  markWallSeenAction,
  restoreBoardPostAction,
  updateBoardPostAction,
} from "./board-post-actions";
import { setOwnAvatarAction } from "./avatar-actions";
import { logoutAction } from "./actions";
import { avatarColorClasses, avatarFaceVariant, boardPostRelevantToMe, boardPostUnreadCount, indexPeople, myNotificationCount, personName, taskNeedsMyAction, taskWorkload } from "./board-derived";
import { BoardView } from "./BoardView";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { CreateMeetingForm } from "./CreateMeetingForm";
import { CreateTaskForm } from "./CreateTaskForm";
import { MeetingCard } from "./MeetingCard";
import { TaskTable } from "./TaskTable";
import { ThemeToggle } from "./ThemeToggle";
import { TrashView } from "./TrashView";
import { MyTasksView } from "./MyTasksView";
import { WorkloadDashboard } from "./WorkloadDashboard";

const OTHER_MEETING_TITLE = "อื่น ๆ";

type MainTab = "board" | "excom" | "other";
type SubTab = MeetingSubTab;

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "excom", label: "Excom" },
  { key: "other", label: "อื่น ๆ" },
];

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "resume", label: "Resume" },
  { key: "draft", label: "ร่างรายงาน" },
  { key: "conduct", label: "Conduct" },
];

const MAIN_TAB_LABEL: Record<MainTab, string> = { board: "Board", excom: "Excom", other: "อื่น ๆ" };
const SUB_TAB_LABEL: Record<SubTab, string> = { resume: "Resume", draft: "ร่างรายงาน", conduct: "Conduct" };

function compareDueDate(a?: string, b?: string): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function describeError(error: "unauthorized" | "version_conflict" | "unknown"): string {
  if (error === "version_conflict") return "ข้อมูลนี้มีการอัปเดตแล้ว กรุณา Refresh หน้าก่อนทำต่อ";
  if (error === "unauthorized") return "คุณไม่มีสิทธิ์ทำรายการนี้";
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

const byOrder = (a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder;

/** หน้าจอที่กำลังเปิดอยู่ — มาจาก route จริง ไม่ใช่ state ในหน่วยความจำอีกต่อไป (ดู DESIGN.md ข้อ 4.14) */
export type AppScreen = "main" | "trash" | "dashboard" | "my-tasks" | "board";

const SCREEN_PATH: Record<AppScreen, string> = {
  main: "/",
  board: "/board",
  "my-tasks": "/my-tasks",
  dashboard: "/dashboard",
  trash: "/trash",
};

export function AppShell({
  screen,
  user,
  owners,
  inspectors,
  workloadPeople,
  allUsers,
  initialMeetings,
  initialOtherTasks,
  initialDeletedTasks,
  initialBoardPosts,
  initialDeletedBoardPosts,
  canManageTasks,
  initialAvatarVariant,
}: {
  screen: AppScreen;
  user: SessionUser;
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
}) {
  // งานเก็บแต่ id ของคน ส่วนชื่อที่แสดงเปิดจากตารางนี้ → admin แก้ชื่อใคร ชื่อใหม่ขึ้นทุกที่โดยงานไม่ขาดจากเขา
  const people = useMemo(() => indexPeople(allUsers), [allUsers]);

  const [mainTab, setMainTab] = useState<MainTab>("board");
  const [subTab, setSubTab] = useState<SubTab>("resume");
  const visibleInspectors = useMemo(
    () => inspectors.filter((person) => isInReviewGroup(person, subTab)),
    [inspectors, subTab]
  );
  const otherInspectors = useMemo(
    () => inspectors.filter((person) => isInReviewGroup(person, "other")),
    [inspectors]
  );
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [otherTasks, setOtherTasks] = useState<Task[]>(initialOtherTasks);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>(initialDeletedTasks);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>(initialBoardPosts);
  const [deletedBoardPosts, setDeletedBoardPosts] = useState<BoardPost[]>(initialDeletedBoardPosts);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();

  /** เปลี่ยนหน้าจอ = เปลี่ยน URL จริง → ปุ่ม Back ของเบราว์เซอร์และการ refresh ทำงานถูกต้องตามที่ควรเป็น */
  function goTo(target: AppScreen) {
    router.push(SCREEN_PATH[target]);
  }

  /*
   * รับข้อมูลชุดใหม่จาก server เมื่อมีการ refresh (pattern เดียวกับ UserList.tsx)
   *
   * เดิมหน้านี้ seed state จาก props ครั้งเดียวแล้วเมินของใหม่ตลอด ทำให้ข้อมูลที่ดึงมาถูกทิ้งเปล่า ๆ
   * และเป็นเหตุให้ตอนแก้ชนกันต้องสั่งผู้ใช้ไป refresh เอง (เสียสิ่งที่พิมพ์ค้างไว้ทั้งหมด)
   */
  const [syncedFrom, setSyncedFrom] = useState(initialMeetings);
  if (initialMeetings !== syncedFrom) {
    setSyncedFrom(initialMeetings);
    setMeetings(initialMeetings);
    setOtherTasks(initialOtherTasks);
    setDeletedTasks(initialDeletedTasks);
    setBoardPosts(initialBoardPosts);
    setDeletedBoardPosts(initialDeletedBoardPosts);
    setConflictMessage(null);
  }

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const otherWorkload = useMemo(() => taskWorkload(otherTasks, otherInspectors), [otherTasks, otherInspectors]);
  const [otherCreating, setOtherCreating] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const isAdmin = user.roles.includes("admin");
  const avatarColor = avatarColorClasses(user.displayName);
  const [avatarVariant, setAvatarVariant] = useState(initialAvatarVariant);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const avatarFace = avatarVariant ?? avatarFaceVariant(user.displayName, AVATAR_FACE_COUNT);

  async function pickAvatar(variant: number) {
    setPickingAvatar(false);
    const previous = avatarVariant;
    setAvatarVariant(variant);
    const result = await setOwnAvatarAction(variant);
    if (!reportIfError(result)) setAvatarVariant(previous);
  }

  const activeMeetings = useMemo(() => meetings.filter((m) => !m.isArchived), [meetings]);
  const archivedMeetings = useMemo(() => meetings.filter((m) => m.isArchived), [meetings]);
  const boardMeetings = useMemo(() => activeMeetings.filter((m) => m.tab === "board"), [activeMeetings]);
  const excomMeetings = useMemo(() => activeMeetings.filter((m) => m.tab === "excom"), [activeMeetings]);
  const activeMainMeetings = mainTab === "excom" ? excomMeetings : boardMeetings;
  const visibleMeetings = useMemo(
    () => activeMainMeetings.filter((m) => m.subTab === subTab).slice().sort(byOrder),
    [activeMainMeetings, subTab]
  );

  const myTaskEntries = useMemo(
    () =>
      [
        ...activeMeetings.flatMap((m) => {
          const meetingInspectors = inspectors.filter((person) => isInReviewGroup(person, m.subTab));
          return m.tasks
            .filter((t) => taskNeedsMyAction(t, user.id))
            .map((task) => ({
              task,
              context: `${MAIN_TAB_LABEL[m.tab]} / ${SUB_TAB_LABEL[m.subTab]} · ${m.title}`,
              inspectors: meetingInspectors,
            }));
        }),
        ...otherTasks
          .filter((t) => taskNeedsMyAction(t, user.id))
          .map((task) => ({ task, context: "อื่น ๆ", inspectors: otherInspectors })),
      ].sort((a, b) => compareDueDate(a.task.dueDate, b.task.dueDate)),
    [activeMeetings, otherTasks, inspectors, otherInspectors, user.id]
  );

  const myBoardPosts = useMemo(
    () => boardPosts.filter((p) => boardPostRelevantToMe(p, user.id)),
    [boardPosts, user.id]
  );
  /*
   * memo ที่ "ยังไม่ได้อ่าน ณ วินาทีที่เปิดหน้า The Wall" — ค้างไว้ติดป้าย New ตลอดรอบที่เปิดหน้านั้นอยู่
   * (ถ้าอิง unread ตรง ๆ ป้ายจะหายพร้อม badge ทันทีจนผู้ใช้ไม่ทันเห็นว่าอันไหนใหม่)
   *
   * useState แบบมีฟังก์ชันตั้งค่าเริ่มต้น = คำนวณครั้งเดียวตอน component เกิด
   * พอแยกเป็น route จริงแล้ว การเข้า /board แต่ละครั้งคือการ mount ใหม่เสมอ จังหวะจึงตรงกับ "เพิ่งกดเข้ามา" พอดี
   */
  const [newPostIds] = useState<ReadonlySet<string>>(() =>
    screen === "board"
      ? new Set(initialBoardPosts.filter((p) => p.unread && p.taggedUserIds.includes(user.id)).map((p) => p.id))
      : new Set()
  );

  /*
   * บอกเซิร์ฟเวอร์ว่าอ่านแล้ว — ทำครั้งเดียวตอนเปิดหน้า The Wall
   * ไม่มี setState ในนี้โดยตั้งใจ (กฎ lint ของ React Compiler ห้าม setState ใน effect — ดูกับดักข้อ 1)
   * badge ที่ Header หักตัวที่เพิ่งอ่านออกด้วยการคำนวณจาก newPostIds แทน ไม่ต้องแก้ state
   */
  useEffect(() => {
    if (newPostIds.size > 0) markWallSeenAction();
  }, [newPostIds]);

  /*
   * Red Badge = "ของใหม่ที่ยังไม่ได้ดู" ทั้งสองจุด (ไอคอนงานของฉัน และไอคอน The Wall)
   * เดิมนับ memo ที่เกี่ยวกับฉันทั้งหมด → ตัวเลขค้างอยู่ตลอดไปจนกว่าจะมีคนลบ memo ทิ้ง
   */
  const unreadBoardPosts = useMemo(
    // หักเฉพาะที่ "เพิ่งเปิดอ่านในหน้านี้" ออก — ของที่ยังไม่ได้เปิดดูจริง ๆ ยังค้าง badge ไว้เหมือนเดิม
    () => boardPostUnreadCount(boardPosts, user.id, newPostIds),
    [boardPosts, user.id, newPostIds]
  );
  const myNotificationTotal = myTaskEntries.length + unreadBoardPosts;


  /*
   * เดิมตัวเลขแจ้งเตือนถูกคำนวณใหม่ทุก render — วนงานทุกชิ้นในระบบอย่างน้อย 7 รอบ
   * แม้แต่ตอนกดเปิดช่องเลือก avatar หรือตอน toast เด้ง ก็คำนวณใหม่ทั้งชุด
   */
  const mainTabNotifications: Record<MainTab, number> = useMemo(
    () => ({
      board: myNotificationCount(boardMeetings.flatMap((m) => m.tasks), user.id),
      excom: myNotificationCount(excomMeetings.flatMap((m) => m.tasks), user.id),
      other: myNotificationCount(otherTasks, user.id),
    }),
    [boardMeetings, excomMeetings, otherTasks, user.id]
  );

  const subTabNotifications: Record<SubTab, number> = useMemo(() => {
    const countIn = (key: SubTab) =>
      myNotificationCount(activeMainMeetings.filter((m) => m.subTab === key).flatMap((m) => m.tasks), user.id);
    return { resume: countIn("resume"), draft: countIn("draft"), conduct: countIn("conduct") };
  }, [activeMainMeetings, user.id]);

  /** ดัชนีค้นหางานด้วย id — เดิมทุกครั้งที่กดปุ่มต้องวน flatMap ทุกครั้งที่ประชุมเพื่อหางานชิ้นเดียว */
  const taskIndex = useMemo(() => {
    const map = new Map<string, Task>();
    for (const m of meetings) for (const t of m.tasks) map.set(t.id, t);
    for (const t of otherTasks) map.set(t.id, t);
    return map;
  }, [meetings, otherTasks]);

  function findTaskById(taskId: string): Task | undefined {
    return taskIndex.get(taskId);
  }

  function reportIfError<T>(result: ActionResult<T>): result is { ok: true; data: T } {
    if (!result.ok) {
      setConflictMessage(describeError(result.error));
      return false;
    }
    return true;
  }

  function applyTaskCreate(created: Task) {
    if (created.meetingId) {
      setMeetings((prev) =>
        prev.map((m) => (m.id === created.meetingId ? { ...m, tasks: [...m.tasks, created] } : m))
      );
    } else {
      setOtherTasks((prev) => [...prev, created]);
    }
  }

  function applyTaskUpdate(updated: Task) {
    if (updated.meetingId) {
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === updated.meetingId ? { ...m, tasks: m.tasks.map((t) => (t.id === updated.id ? updated : t)) } : m
        )
      );
    } else {
      setOtherTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  }

  function applyTaskDelete(deleted: Task) {
    if (deleted.meetingId) {
      setMeetings((prev) =>
        prev.map((m) => (m.id === deleted.meetingId ? { ...m, tasks: m.tasks.filter((t) => t.id !== deleted.id) } : m))
      );
    } else {
      setOtherTasks((prev) => prev.filter((t) => t.id !== deleted.id));
    }
    setDeletedTasks((prev) => [...prev, deleted]);
  }

  function applyTaskRestore(restored: Task) {
    setDeletedTasks((prev) => prev.filter((t) => t.id !== restored.id));
    applyTaskCreate(restored);
  }

  async function createMeeting(input: {
    title: string;
    timeline: string;
    tab: MeetingTab;
    subTab: SubTab;
    templateTaskTitles?: string[];
  }) {
    const { templateTaskTitles, ...meetingInput } = input;
    const result = await createMeetingAction(meetingInput);
    if (!reportIfError(result)) return;
    const newMeetingId = result.data.id;
    setMeetings((prev) => [...prev, { ...result.data, tasks: [] }]);
    if (templateTaskTitles) {
      for (const title of templateTaskTitles) {
        const taskResult = await createTaskAction({ meetingId: newMeetingId, title, urgent: false });
        if (taskResult.ok) {
          setMeetings((prev) =>
            prev.map((m) => (m.id === newMeetingId ? { ...m, tasks: [...m.tasks, taskResult.data] } : m))
          );
        }
      }
    }
  }

  async function createTask(meetingId: string, input: TaskInput) {
    const result = await createTaskAction({ meetingId, ...input });
    if (!reportIfError(result)) return;
    applyTaskCreate(result.data);
  }

  async function createOtherTask(input: TaskInput) {
    const result = await createTaskAction({ meetingId: null, ...input });
    if (!reportIfError(result)) return;
    applyTaskCreate(result.data);
  }

  async function editTask(taskId: string, input: TaskInput, checklist: ChecklistItem[], excludedAutoSteps: string[]) {
    const task = findTaskById(taskId);
    if (!task) return;
    const result = await updateTaskDetailsAction({ id: taskId, ...input, checklist, excludedAutoSteps, version: task.version });
    if (!reportIfError(result)) return;
    applyTaskUpdate(result.data);
  }

  /** ส่ง patch ที่ได้จาก task-workflow.ts ขึ้น server แล้วอัปเดตหน้าจอ */
  async function commitWorkflow(task: Task, patch: WorkflowPatch) {
    const result = await updateTaskWorkflowAction({
      id: task.id,
      version: task.version,
      status: patch.status,
      inspectorId: patch.inspectorId,
      history: patch.history,
    });
    if (!reportIfError(result)) return;
    applyTaskUpdate(result.data);
  }

  function sendForReview(taskId: string, inspectorId: string, message?: string, choice?: SkippedReviewChoice) {
    const task = findTaskById(taskId);
    if (!task) return;
    return commitWorkflow(
      task,
      buildSendTransition(task, {
        inspectorId,
        newInspectorName: personName(people, inspectorId),
        ownerName: personName(people, task.ownerId),
        inspectorName: personName(people, task.inspectorId),
        message,
        choice,
        actor: user,
      })
    );
  }

  function markReviewed(taskId: string, message?: string) {
    const task = findTaskById(taskId);
    if (!task) return;
    return commitWorkflow(
      task,
      buildReviewTransition(task, { message, inspectorName: personName(people, task.inspectorId) })
    );
  }

  function closeTask(taskId: string, choice?: SkippedReviewChoice) {
    const task = findTaskById(taskId);
    if (!task) return;
    return commitWorkflow(
      task,
      buildCloseTransition(task, {
        choice,
        actor: user,
        ownerName: personName(people, task.ownerId),
        inspectorName: personName(people, task.inspectorId),
      })
    );
  }

  function reopenTask(taskId: string) {
    const task = findTaskById(taskId);
    if (!task) return;
    return commitWorkflow(task, buildReopenTransition(task));
  }

  function addHistoryNote(taskId: string, entryId: string, text: string) {
    const task = findTaskById(taskId);
    if (!task) return;
    return commitWorkflow(task, buildAddNoteTransition(task, { entryId, text }));
  }

  async function deleteTask(taskId: string) {
    const task = findTaskById(taskId);
    if (!task) return;
    const result = await deleteTaskAction({ id: taskId, version: task.version });
    if (!reportIfError(result)) return;
    applyTaskDelete(result.data);
  }

  async function restoreTask(taskId: string) {
    const result = await restoreTaskAction({ id: taskId });
    if (!reportIfError(result)) return;
    applyTaskRestore(result.data);
  }

  async function deleteTaskForever(taskId: string) {
    const task = deletedTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!confirm("ลบรายการนี้ถาวรใช่หรือไม่? การลบไม่สามารถย้อนกลับได้")) return;
    const result = await deleteTaskForeverAction({ id: taskId, version: task.version });
    if (!reportIfError(result)) return;
    setDeletedTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function createBoardPost(input: BoardPostInput) {
    const result = await createBoardPostAction(input);
    if (!reportIfError(result)) return;
    setBoardPosts((prev) => [result.data, ...prev]);
  }

  async function editBoardPost(postId: string, input: BoardPostInput) {
    const post = boardPosts.find((p) => p.id === postId);
    if (!post) return;
    const result = await updateBoardPostAction({ id: postId, version: post.version, ...input });
    if (!reportIfError(result)) return;
    setBoardPosts((prev) => prev.map((p) => (p.id === postId ? result.data : p)));
  }

  async function addBoardComment(postId: string, body: string) {
    const post = boardPosts.find((p) => p.id === postId);
    if (!post) return;
    const result = await addBoardCommentAction({ postId, body, version: post.version });
    if (!reportIfError(result)) return;
    setBoardPosts((prev) => prev.map((p) => (p.id === postId ? result.data : p)));
  }

  async function deleteBoardComment(postId: string, commentId: string) {
    const post = boardPosts.find((p) => p.id === postId);
    if (!post) return;
    const result = await deleteBoardCommentAction({ postId, commentId, version: post.version });
    if (!reportIfError(result)) return;
    setBoardPosts((prev) => prev.map((p) => (p.id === postId ? result.data : p)));
    showToast("Comment deleted");
  }

  async function deleteBoardPost(postId: string) {
    const post = boardPosts.find((p) => p.id === postId);
    if (!post) return;
    const result = await deleteBoardPostAction({ id: postId, version: post.version });
    if (!reportIfError(result)) return;
    setBoardPosts((prev) => prev.filter((p) => p.id !== postId));
    setDeletedBoardPosts((prev) => [...prev, result.data]);
  }

  async function restoreBoardPost(postId: string) {
    const result = await restoreBoardPostAction({ id: postId });
    if (!reportIfError(result)) return;
    setDeletedBoardPosts((prev) => prev.filter((p) => p.id !== postId));
    setBoardPosts((prev) => [result.data, ...prev]);
  }

  async function deleteBoardPostForever(postId: string) {
    const post = deletedBoardPosts.find((p) => p.id === postId);
    if (!post) return;
    if (!confirm("ลบกระทู้นี้ถาวรใช่หรือไม่? การลบไม่สามารถย้อนกลับได้")) return;
    const result = await deleteBoardPostForeverAction({ id: postId, version: post.version });
    if (!reportIfError(result)) return;
    setDeletedBoardPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  async function archiveMeeting(meetingId: string) {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    const result = await archiveMeetingAction({ id: meetingId, version: meeting.version });
    if (!reportIfError(result)) return;
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, ...result.data } : m)));
  }

  async function editMeetingDetails(meetingId: string, title: string, timeline: string) {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    const result = await updateMeetingDetailsAction({ id: meetingId, version: meeting.version, title, timeline });
    if (!reportIfError(result)) return;
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, ...result.data } : m)));
  }

  async function restoreMeeting(meetingId: string) {
    const result = await restoreMeetingAction({ id: meetingId });
    if (!reportIfError(result)) return;
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, ...result.data } : m)));
  }

  async function deleteMeetingForever(meetingId: string) {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    if (!confirm(`ลบ "${meeting.title}" ถาวรใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`)) return;
    const result = await deleteMeetingForeverAction({ id: meetingId, version: meeting.version });
    if (!reportIfError(result)) return;
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary font-display text-[15px] font-bold text-on-primary">
            W
          </div>
          <div>
            <div className="font-display text-[15px] font-semibold leading-tight text-text">
              Workload Tracker
            </div>
            <div className="text-[11.5px] text-muted">ระบบติดตามภาระงาน</div>
          </div>

          <span className="mx-1 h-8 w-px flex-none bg-border" aria-hidden="true" />

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              title="เปลี่ยน Avatar"
              onClick={() => setPickingAvatar((v) => !v)}
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-full hover:opacity-80 ${avatarColor.bg} ${avatarColor.text}`}
            >
              <AvatarFace variant={avatarFace} className="h-5 w-5" />
            </button>
            <span className="text-[13px] font-medium text-text">{user.displayName}</span>

            {pickingAvatar && (
              <div className="absolute top-full left-0 z-30 mt-2 grid w-52 grid-cols-5 gap-1.5 rounded-lg border border-border bg-surface p-3 shadow-lg">
                {Array.from({ length: AVATAR_FACE_COUNT }, (_, variant) => (
                  <button
                    key={variant}
                    type="button"
                    title={`Avatar ${variant + 1}`}
                    onClick={() => pickAvatar(variant)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full hover:ring-2 hover:ring-accent ${avatarColor.bg} ${avatarColor.text} ${
                      avatarFace === variant ? "ring-2 ring-accent" : ""
                    }`}
                  >
                    <AvatarFace variant={variant} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* กลุ่ม 1: เครื่องมือหลักที่ใช้บ่อย เรียงจากส่วนตัวสุดไปภาพรวมสุด */}
          {/*
            เป็น <Link> ไม่ใช่ <button> เพราะเป็นการ "ไปอีกหน้า" จริง ๆ แล้ว (ตั้งแต่แยก route 2026-09-16)
            ได้ของแถมคือ Next.js prefetch หน้าปลายทางให้ตอนเลื่อนมาเห็น กดแล้วขึ้นทันที และคลิกกลางเพื่อเปิดแท็บใหม่ได้
          */}
          <Link
            href="/my-tasks"
            title="งานของฉัน"
            className="relative inline-flex items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"
          >
            <ChecklistIcon />
            {myNotificationTotal > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-pending px-1 text-[11px] font-bold leading-none text-bg">
                {myNotificationTotal}
              </span>
            )}
          </Link>
          <Link
            href="/board"
            title="The Wall"
            className="relative inline-flex items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"
          >
            <BoardIcon />
            {unreadBoardPosts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-pending px-1 text-[11px] font-bold leading-none text-bg">
                {unreadBoardPosts}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard"
            title="แดชบอร์ดภาระงาน"
            className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"
          >
            <ChartIcon />
          </Link>

          <span className="mx-0.5 h-5 w-px flex-none bg-border" aria-hidden="true" />

          {/* กลุ่ม 2: บัญชี/การตั้งค่าส่วนตัว */}
          {user.roles.includes("admin") && (
            <Link
              href="/admin/users"
              title="จัดการผู้ใช้งาน"
              className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"
            >
              <SettingsIcon />
            </Link>
          )}
          <details className="relative">
            <summary
              title="เปลี่ยนรหัสผ่าน"
              className="flex cursor-pointer list-none items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"
            >
              <KeyIcon />
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-border bg-surface p-3 shadow-lg">
              <ChangePasswordForm />
            </div>
          </details>
          <ThemeToggle />

          <span className="mx-0.5 h-5 w-px flex-none bg-border" aria-hidden="true" />

          {/* กลุ่ม 3: ทำลาย/ออกจากระบบ แยกไว้ท้ายสุดเสมอ */}
          {isAdmin && (
            <Link
              href="/trash"
              title="ถังขยะ"
              className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"
            >
              <ArchiveBoxIcon />
            </Link>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text hover:border-accent hover:text-accent"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-text px-4 py-2 text-sm font-medium text-bg shadow-lg">
          {toast}
        </div>
      )}

      {conflictMessage && (
        <div className="flex items-center justify-between gap-3 border-b border-pending bg-pending-soft px-6 py-2.5 text-sm text-pending">
          <span>{conflictMessage}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
              className="rounded-lg bg-pending px-3 py-1 text-xs font-bold text-bg disabled:opacity-60"
            >
              {refreshing ? "กำลังดึงข้อมูล..." : "ดูข้อมูลล่าสุด"}
            </button>
            <button type="button" onClick={() => setConflictMessage(null)} className="text-xs font-medium hover:underline">
              ปิด
            </button>
          </div>
        </div>
      )}

      {screen === "trash" && isAdmin ? (
        <TrashView
          archivedMeetings={archivedMeetings}
          deletedTasks={deletedTasks}
          deletedBoardPosts={deletedBoardPosts}
          canManageTasks={canManageTasks}
          onBack={() => goTo("main")}
          onRestoreMeeting={restoreMeeting}
          onDeleteMeetingForever={deleteMeetingForever}
          onRestoreTask={restoreTask}
          onDeleteTaskForever={deleteTaskForever}
          onRestoreBoardPost={restoreBoardPost}
          onDeleteBoardPostForever={deleteBoardPostForever}
        />
      ) : screen === "board" ? (
        <BoardView
          posts={boardPosts}
          newPostIds={newPostIds}
          allUsers={allUsers}
          currentUserId={user.id}
          canManageTasks={canManageTasks}
          onBack={() => goTo("main")}
          onCreatePost={createBoardPost}
          onEditPost={editBoardPost}
          onDeletePost={deleteBoardPost}
          onAddComment={addBoardComment}
          onDeleteComment={deleteBoardComment}
        />
      ) : screen === "dashboard" ? (
        <WorkloadDashboard
          people={workloadPeople}
          meetings={activeMeetings}
          otherTasks={otherTasks}
          isAdmin={isAdmin}
          onBack={() => goTo("main")}
        />
      ) : screen === "my-tasks" ? (
        <MyTasksView
          entries={myTaskEntries}
          boardPosts={myBoardPosts}
          allUsers={allUsers}
          people={people}
          currentUserId={user.id}
          owners={owners}
          canManageTasks={canManageTasks}
          onBack={() => goTo("main")}
          onDeleteTask={deleteTask}
          onEditTask={editTask}
          onSendForReview={sendForReview}
          onMarkReviewed={markReviewed}
          onCloseTask={closeTask}
          onReopenTask={reopenTask}
          onAddHistoryNote={addHistoryNote}
          onAddBoardComment={addBoardComment}
          onEditBoardPost={editBoardPost}
          onDeleteBoardComment={deleteBoardComment}
        />
      ) : (
        <div className="mx-auto w-full max-w-5xl flex-1 px-2.5 py-6 sm:px-4 lg:max-w-6xl lg:py-8">
          <div className="flex w-full gap-0.5 rounded-[10px] bg-closed-soft p-[3px]">
            {MAIN_TABS.map((tab, i) => {
              const isActive = mainTab === tab.key;
              const nextIsActive = MAIN_TABS[i + 1] && mainTab === MAIN_TABS[i + 1].key;
              const showDivider = i < MAIN_TABS.length - 1 && !isActive && !nextIsActive;
              return (
                <button
                  key={tab.key}
                  onClick={() => setMainTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[13.5px] font-medium transition-colors lg:px-5 lg:py-3.5 lg:text-base ${
                    isActive ? "bg-surface text-text shadow-sm" : "text-muted"
                  } ${showDivider ? "border-r border-border" : ""}`}
                >
                  <span>{tab.label}</span>
                  {mainTabNotifications[tab.key] > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pending px-1 text-[11px] font-bold leading-none text-bg lg:h-6 lg:min-w-6 lg:text-[12.5px]">
                      {mainTabNotifications[tab.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {mainTab !== "other" && (
            <div className="mt-3.5 flex gap-1.5 sm:gap-2.5 lg:mt-5 lg:gap-3.5">
              {SUB_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSubTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-full border px-2.5 py-3 text-center text-[13px] font-medium transition-colors sm:gap-1.5 sm:px-5 sm:text-sm lg:py-3.5 lg:text-base ${
                    subTab === tab.key
                      ? "border-transparent bg-accent-soft font-semibold text-accent"
                      : "border-border text-muted hover:bg-closed-soft hover:text-text"
                  }`}
                >
                  <span>{tab.label}</span>
                  {subTabNotifications[tab.key] > 0 && (
                    <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-pending px-1 text-[11px] font-bold leading-none text-bg sm:h-5 sm:min-w-5 sm:text-[11px] lg:h-6 lg:min-w-6 lg:text-[12.5px]">
                      {subTabNotifications[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {mainTab === "other" ? (
            <div className="mt-4.5 rounded-2xl border border-border bg-surface p-3 sm:p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-text lg:text-xl">อื่น ๆ</h2>
                {canManageTasks && (
                  <button
                    type="button"
                    onClick={() => setOtherCreating(true)}
                    className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary lg:px-4 lg:py-2.5 lg:text-[13px]"
                  >
                    + เพิ่มเรื่อง
                  </button>
                )}
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2 lg:mt-4">
                <span className="text-xs text-muted lg:text-sm">เอกสารรอตรวจอยู่ที่</span>
                {otherWorkload.map((entry) => (
                  <span
                    key={entry.name}
                    className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-accent lg:px-3 lg:py-1 lg:text-sm"
                  >
                    {entry.name} {entry.count}
                  </span>
                ))}
              </div>

              {otherCreating && (
                <CreateTaskForm
                  owners={owners}
                  onCreate={(input) => {
                    createOtherTask(input);
                    setOtherCreating(false);
                  }}
                  onCancel={() => setOtherCreating(false)}
                />
              )}

              <div className="mt-3.5">
                <TaskTable
                  tasks={otherTasks.slice().sort(byOrder)}
                  owners={owners}
                  inspectors={otherInspectors}
                  people={people}
                  canManageTasks={canManageTasks}
                  currentUserId={user.id}
                  onDeleteTask={deleteTask}
                  onEditTask={editTask}
                  onSendForReview={sendForReview}
                  onMarkReviewed={markReviewed}
                  onCloseTask={closeTask}
                  onReopenTask={reopenTask}
                  onAddHistoryNote={addHistoryNote}
                />
              </div>
            </div>
          ) : (
            <>
              {canManageTasks && (
                <div className="mt-4.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCreatingMeeting(true)}
                    className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary"
                  >
                    + ครั้งที่ประชุม
                  </button>
                </div>
              )}

              {creatingMeeting && (
                <CreateMeetingForm
                  defaultTab={mainTab === "excom" ? "excom" : "board"}
                  defaultSubTab={subTab}
                  resumeMeetings={activeMeetings
                    .filter((m) => m.subTab === "resume")
                    .map((m) => ({ id: m.id, title: m.title, tab: m.tab, taskTitles: m.tasks.map((t) => t.title) }))}
                  onCreate={(input) => {
                    createMeeting(input);
                    setCreatingMeeting(false);
                  }}
                  onCancel={() => setCreatingMeeting(false)}
                />
              )}

              <div className="mt-3.5 flex flex-col gap-4 lg:mt-5 lg:gap-5">
                {visibleMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    owners={owners}
                    inspectors={visibleInspectors}
          people={people}
                    canManageTasks={canManageTasks}
                    currentUserId={user.id}
                    onArchive={archiveMeeting}
                    onEditDetails={editMeetingDetails}
                    onCreateTask={createTask}
                    onDeleteTask={deleteTask}
                    onEditTask={editTask}
                    onSendForReview={sendForReview}
                    onMarkReviewed={markReviewed}
                    onCloseTask={closeTask}
                    onReopenTask={reopenTask}
                    onAddHistoryNote={addHistoryNote}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
