// crypto.randomUUID() only works in a secure context (HTTPS or localhost) — this app
// is also accessed over plain HTTP via LAN IP, so IDs here can't depend on it.
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type TaskStatus = "blank" | "pending" | "done" | "closed";

export type HistoryAction = "sent" | "reviewed" | "closed" | "reopened";

export type HistoryNote = {
  id: string;
  text: string;
  at: string;
};

export type HistoryEntry = {
  id: string;
  action: HistoryAction;
  /** รหัสประจำตัวผู้รับผิดชอบ/ผู้ตรวจ ณ ตอนนั้น — ใช้จับคู่คน (ชื่อเปลี่ยนได้ id ไม่เปลี่ยน) */
  ownerId?: string;
  inspectorId?: string;
  /** ชื่อ ณ ตอนที่บันทึก เก็บไว้เป็นสำรองกรณีผู้ใช้ถูกลบ — การแสดงผลจะเปิดชื่อปัจจุบันจาก id ก่อนเสมอ */
  owner?: string;
  inspector?: string;
  message?: string;
  notes?: HistoryNote[];
  at: string;
  /**
   * มีค่าก็ต่อเมื่อ entry นี้ถูก "บันทึกย้อนหลัง" โดยคนอื่น ไม่ใช่เจ้าตัวกดเองในระบบ
   * เช่น ผู้บังคับบัญชาตรวจเอกสารแล้วแต่ไม่ได้กดปุ่ม เจ้าของงานจึงบันทึกแทนตอนปิดงาน
   * แสดงผลใน Timeline ว่า "A > ตรวจแล้ว (บันทึกย้อนหลังโดย สมชาย)" เพื่อให้ตรวจสอบย้อนหลังได้ว่าใครบันทึก
   */
  recordedBy?: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type Task = {
  id: string;
  meetingId: string | null;
  title: string;
  ecmNumber?: string;
  /** อ้างถึง users.id — เดิมเก็บเป็นชื่อ ทำให้พอแก้ชื่อคนแล้วงานเก่าขาดจากเขาทั้งหมด */
  ownerId?: string;
  dueDate?: string;
  status: TaskStatus;
  inspectorId?: string;
  urgent: boolean;
  note?: string;
  history: HistoryEntry[];
  checklist: ChecklistItem[];
  excludedAutoSteps: string[];
  deletedFromMeetingTitle?: string;
  sortOrder: number;
  version: number;
};

export type MeetingTab = "board" | "excom";
export type MeetingSubTab = Exclude<ReviewGroup, "other">;

export type Meeting = {
  id: string;
  title: string;
  timeline?: string;
  tab: MeetingTab;
  subTab: MeetingSubTab;
  isArchived: boolean;
  sortOrder: number;
  version: number;
  tasks: Task[];
};

export type TaskInput = {
  title: string;
  ecmNumber?: string;
  ownerId?: string;
  dueDate?: string;
  urgent: boolean;
  note?: string;
};

export type Person = {
  id: string;
  displayName: string;
  reviewGroups?: string[];
};

export type ReviewGroup = "resume" | "draft" | "conduct" | "other";

export const REVIEW_GROUPS: { key: ReviewGroup; label: string }[] = [
  { key: "resume", label: "Resume" },
  { key: "draft", label: "ร่างรายงาน" },
  { key: "conduct", label: "Conduct" },
  { key: "other", label: "อื่น ๆ" },
];

export function isInReviewGroup(person: Person, group: ReviewGroup): boolean {
  return !person.reviewGroups?.length || person.reviewGroups.includes(group);
}

export type BoardComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  at: string;
};

export type BoardPost = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  reminderDate?: string;
  /**
   * "ฉันถูก tag ไว้ในโพสต์นี้ และยังไม่ได้เปิดดูหน้า The Wall เลยตั้งแต่มันถูกโพสต์"
   * ฐานข้อมูลคำนวณมาให้เฉพาะผู้ใช้ที่เรียก (จากคอลัมน์ board_posts.seen_by — ดู migration 0007)
   */
  unread: boolean;
  taggedUserIds: string[];
  taggedNames: string[];
  comments: BoardComment[];
  version: number;
  createdAt: string;
};

export type BoardPostInput = {
  body: string;
  reminderDate?: string;
  taggedUserIds: string[];
};
