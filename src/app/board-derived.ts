import type { BoardPost, Meeting, MeetingSubTab, MeetingTab, Person, Task } from "./board-types";

/** เครื่องหมายแทนค่าว่าง/ไม่มีข้อมูล ใช้ให้เหมือนกันทั้งแอป — สั้น จาง บาง ไม่เน้น */
export const EMPTY_MARK = "–";
/** จาง แต่ยังต้องอ่านออก — /40 เดิมให้ contrast ราว 1.8:1 ต่ำกว่าเกณฑ์ WCAG AA มาก (แก้ U11) */
export const EMPTY_MARK_CLASS = "font-normal text-muted/70";

/**
 * ตารางเปิดชื่อจากรหัสประจำตัว
 *
 * งาน/ประวัติเก็บแต่ id ส่วนชื่อที่แสดงบนหน้าจอเปิดจากตารางนี้เสมอ
 * → admin แก้ชื่อใครสักคน ชื่อใหม่ขึ้นทุกที่ทันทีโดยงานไม่ขาดจากเขา (ต่างจากเดิมที่ฝังชื่อไว้ในงาน)
 */
export type PeopleIndex = ReadonlyMap<string, string>;

export function indexPeople(people: Person[]): PeopleIndex {
  return new Map(people.map((p) => [p.id, p.displayName]));
}

/** `fallback` คือชื่อที่บันทึกไว้ ณ ตอนนั้น ใช้เมื่อผู้ใช้ถูกลบไปแล้วจนเปิดชื่อปัจจุบันไม่ได้ */
export function personName(index: PeopleIndex, id?: string, fallback?: string): string {
  if (!id) return fallback ?? "";
  return index.get(id) ?? fallback ?? "ผู้ใช้ที่ถูกลบแล้ว";
}

export function taskStatusLabel(task: Task, people: PeopleIndex): string {
  const inspector = personName(people, task.inspectorId);
  switch (task.status) {
    case "pending":
      return `ส่ง ${inspector}`.trim();
    case "done":
      return `${inspector} แล้ว`.trim();
    case "closed":
      return "ปิดงาน";
    default:
      return "";
  }
}

export function meetingStatusLabel(meeting: Meeting): string {
  const total = meeting.tasks.length;
  if (total === 0) return "ยังไม่มีวาระ";
  const closed = meeting.tasks.filter((t) => t.status === "closed").length;
  return `ปิดงาน ${closed}/${total}`;
}

export type ProgressStep = {
  key: string;
  label: string;
  done: boolean;
  auto: boolean;
};

export function taskSteps(task: Task, inspectors: Person[], people: PeopleIndex): ProgressStep[] {
  const history = task.history ?? [];
  const closed = task.status === "closed";
  const excluded = new Set(task.excludedAutoSteps ?? []);
  const sentTo = new Set(history.filter((h) => h.action === "sent").map((h) => h.inspectorId));
  const reviewedBy = new Set(history.filter((h) => h.action === "reviewed").map((h) => h.inspectorId));

  // ผู้ตรวจที่เคยเกี่ยวข้องกับงานนี้แต่ไม่ได้อยู่ในรายชื่อผู้ตรวจปัจจุบันแล้ว ก็ยังต้องแสดงขั้นตอนของเขา
  const ids = inspectors.map((p) => p.id);
  for (const id of [...sentTo, ...reviewedBy]) {
    if (id && !ids.includes(id)) ids.push(id);
  }

  // key ผูกกับ id ไม่ใช่ชื่อ — ขั้นตอนที่ผู้ใช้ลบทิ้งไว้จึงไม่โผล่กลับมาเมื่อมีการเปลี่ยนชื่อคน
  const steps: ProgressStep[] = ids.flatMap((id) => {
    const name = personName(people, id);
    const pair: ProgressStep[] = [];
    if (!excluded.has(`sent:${id}`)) {
      pair.push({ key: `sent:${id}`, label: `ส่งตรวจ${name}`, done: closed || sentTo.has(id), auto: true });
    }
    if (!excluded.has(`reviewed:${id}`)) {
      pair.push({ key: `reviewed:${id}`, label: `${name}ตรวจแล้ว`, done: closed || reviewedBy.has(id), auto: true });
    }
    return pair;
  });

  for (const item of task.checklist ?? []) {
    steps.push({ key: `custom:${item.id}`, label: item.label, done: closed || item.done, auto: false });
  }

  steps.push({ key: "closed", label: "ปิดงาน", done: closed, auto: true });
  return steps;
}

export function taskProgress(steps: ProgressStep[]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
}

export function taskWorkload(tasks: Task[], inspectors: Person[]): { name: string; count: number }[] {
  return inspectors.map((person) => ({
    name: person.displayName,
    count: tasks.filter((t) => t.status === "pending" && t.inspectorId === person.id).length,
  }));
}

export function taskNeedsMyAction(task: Task, userId: string): boolean {
  return (
    (task.status === "blank" && task.ownerId === userId) ||
    (task.status === "pending" && task.inspectorId === userId) ||
    (task.status === "done" && task.ownerId === userId)
  );
}

export function myNotificationCount(tasks: Task[], userId: string): number {
  return tasks.filter((t) => taskNeedsMyAction(t, userId)).length;
}

/** งานที่ยังต้องดำเนินการเอง: ยังไม่เคยส่งตรวจ หรือถูกตรวจกลับมาแล้วรอกดปิดงาน */
function onHandCount(tasks: Task[], userId: string): number {
  return tasks.filter((t) => (t.status === "blank" || t.status === "done") && t.ownerId === userId).length;
}

/** งานที่ส่งออกไปตรวจแล้ว กำลังรออยู่ที่ผู้ตรวจ (ยังเป็นผู้รับผิดชอบอยู่ ไม่ใช่ปิดงานแล้ว) */
function inProcessCount(tasks: Task[], userId: string): number {
  return tasks.filter((t) => t.status === "pending" && t.ownerId === userId).length;
}

/** งานที่ต้องตรวจ เฉพาะบทบาทผู้ตรวจ (status pending ที่ตนเป็น inspector) — ไม่รวมงานที่เคยตรวจแล้ว */
function toReviewCount(tasks: Task[], userId: string): number {
  return tasks.filter((t) => t.status === "pending" && t.inspectorId === userId).length;
}

/**
 * `short` คือชื่อคอลัมน์ฉบับย่อสำหรับจอมือถือ แยกเป็นสองบรรทัด (บน = Board/Excom, ล่าง = กลุ่มตรวจ)
 * จำเป็นเพราะตัวอักษรขั้นต่ำถูกยกขึ้นเป็น 11px ตามเกณฑ์การอ่านออก (U11) แล้วชื่อเต็มชนกันเองที่ความกว้าง 375px
 */
export type WorkloadMatrixColumn = { key: string; label: string; shortTop: string; shortBottom: string };
export type WorkloadMatrixRow = { id: string; name: string; counts: number[]; total: number };

const WORKLOAD_MATRIX_COLUMNS: {
  key: string;
  label: string;
  shortTop: string;
  shortBottom: string;
  tab?: MeetingTab;
  subTab?: MeetingSubTab;
  isOther?: boolean;
}[] = [
  { key: "board-resume", label: "Board / Resume", shortTop: "B", shortBottom: "Re", tab: "board", subTab: "resume" },
  { key: "board-draft", label: "Board / ร่างรายงาน", shortTop: "B", shortBottom: "ร่าง", tab: "board", subTab: "draft" },
  { key: "board-conduct", label: "Board / Conduct", shortTop: "B", shortBottom: "Con", tab: "board", subTab: "conduct" },
  { key: "excom-resume", label: "Excom / Resume", shortTop: "Ex", shortBottom: "Re", tab: "excom", subTab: "resume" },
  { key: "excom-draft", label: "Excom / ร่างรายงาน", shortTop: "Ex", shortBottom: "ร่าง", tab: "excom", subTab: "draft" },
  { key: "excom-conduct", label: "Excom / Conduct", shortTop: "Ex", shortBottom: "Con", tab: "excom", subTab: "conduct" },
  { key: "other", label: "อื่น ๆ", shortTop: "อื่น", shortBottom: "ๆ", isOther: true },
];

export function workloadMatrix(
  meetings: Meeting[],
  otherTasks: Task[],
  people: Person[]
): { columns: WorkloadMatrixColumn[]; rows: WorkloadMatrixRow[] } {
  const uniquePeople = Array.from(new Map(people.map((p) => [p.id, p])).values());

  const tasksByColumn = WORKLOAD_MATRIX_COLUMNS.map((col) =>
    col.isOther ? otherTasks : meetings.filter((m) => m.tab === col.tab && m.subTab === col.subTab).flatMap((m) => m.tasks)
  );

  const rows = uniquePeople.map((person) => {
    const counts = tasksByColumn.map(
      (tasks) =>
        onHandCount(tasks, person.id) +
        inProcessCount(tasks, person.id) +
        toReviewCount(tasks, person.id)
    );
    return { id: person.id, name: person.displayName, counts, total: counts.reduce((sum, c) => sum + c, 0) };
  });

  return {
    columns: WORKLOAD_MATRIX_COLUMNS.map(({ key, label, shortTop, shortBottom }) => ({ key, label, shortTop, shortBottom })),
    rows,
  };
}

/** กระทู้บอร์ดที่เกี่ยวข้องกับฉัน: ฉันเป็นคนสร้าง หรือถูก Tag ไว้ — ใช้ทั้งกรอง "งานของฉัน" และนับ Red Badge */
export function boardPostRelevantToMe(post: BoardPost, userId: string): boolean {
  return post.authorId === userId || post.taggedUserIds.includes(userId);
}

/**
 * Red Badge ของ The Wall = memo ที่ tag ฉันไว้และฉันยังไม่ได้เปิดดู
 *
 * เดิมนับ "ทุกโพสต์ที่เกี่ยวกับฉัน" ซึ่งไม่มีวันเป็นศูนย์จนกว่าจะมีคนลบโพสต์
 * ค่า unread ถูกคำนวณมาจากฐานข้อมูลแล้ว (คอลัมน์ seen_by — ดู migration 0007) ที่นี่แค่นับ
 */
export function boardPostUnreadCount(
  posts: BoardPost[],
  userId: string,
  /** id ของ memo ที่เพิ่งถูกเปิดอ่านในหน้านี้แล้ว (ฝั่งเซิร์ฟเวอร์ยังไม่ทันส่งค่าใหม่กลับมา) */
  justRead: ReadonlySet<string> = new Set()
): number {
  return posts.filter((p) => p.unread && !justRead.has(p.id) && p.taggedUserIds.includes(userId)).length;
}

/*
 * ── วันที่/เวลา: ยึดเวลาไทยเสมอ ไม่ใช่เวลาของเครื่องที่รันโค้ด (แก้ B12) ────────────────
 *
 * ของเดิมใช้ new Date("2026-09-17T00:00:00") กับ d.getDate() ซึ่งแปลผลตามเขตเวลาของ "เครื่องที่รัน"
 * → เซิร์ฟเวอร์ (ปกติตั้งเป็น UTC ตอน deploy ขึ้น cloud) กับเบราว์เซอร์ผู้ใช้ (UTC+7) ได้คนละวัน
 *   ผลคือ badge "ใกล้ครบกำหนด" เพี้ยนไป 1 วัน และ HTML ที่ server สร้างไม่ตรงกับที่ browser สร้าง (hydration mismatch)
 * ตอนนี้คำนวณด้วย UTC + ชดเชย +7 ชั่วโมงเองทั้งหมด → ได้ผลเท่ากันทุกเครื่องทุกเขตเวลา
 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** แปลง "YYYY-MM-DD" เป็นจุดเวลาที่แน่นอน (เที่ยงคืนของวันนั้น อ่านค่ากลับด้วย getUTC* เสมอ) */
function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** เลขวันที่ของ "วันนี้" ตามเวลาไทย (นับเป็นจำนวนวันตั้งแต่ epoch) */
function thaiDayNumber(at: Date): number {
  return Math.floor((at.getTime() + BANGKOK_OFFSET_MS) / 86400000);
}

/**
 * ความเร่งด่วนของวันที่เตือน ใช้เลือกสี badge — ครบกำหนดแล้วหรือภายใน 3 วันถือว่า "ใกล้ถึง"
 * รับ `now` เข้ามาได้เพื่อให้เขียน test ได้โดยไม่ต้องพึ่งนาฬิกาเครื่อง
 */
export function reminderUrgency(reminderDate?: string, now: Date = new Date()): "soon" | "later" | undefined {
  if (!reminderDate) return undefined;
  const target = parseDateOnly(reminderDate);
  if (!target) return undefined;
  const diffDays = Math.floor(target.getTime() / 86400000) - thaiDayNumber(now);
  return diffDays <= 3 ? "soon" : "later";
}

/** วันที่แบบสั้น พ.ศ. 2 หลัก ("17/09/69") — ใช้ร่วมกันทั้งวาระและโพสต์บอร์ด */
export function formatShortDate(value?: string): string | null {
  if (!value) return null;
  const d = parseDateOnly(value);
  if (!d) return null;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear() + 543).slice(-2);
  return `${day}/${month}/${yy}`;
}

/** วันเวลาเต็มของบรรทัดใน Timeline ("16/9/2569 14:30:05") — เวลาไทยเสมอ ไม่ว่าจะ render ที่ไหน */
export function formatLogDateTime(iso: string): string {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) return "";
  const d = new Date(base.getTime() + BANGKOK_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear() + 543} ${hh}:${mm}:${ss}`;
}

/**
 * เวลาแบบสัมพัทธ์ ("2h ago") สำหรับโพสต์บอร์ด — ใช้ภาษาอังกฤษตามธีมของฟีเจอร์ The Wall/Memo
 * ⚠️ ผลลัพธ์ขึ้นกับ "ตอนนี้กี่โมง" จึงห้ามเรียกตรง ๆ ในโค้ดที่ render ฝั่งเซิร์ฟเวอร์
 *    ให้ใช้ component <RelativeTime> ซึ่งแสดงวันเวลาเต็มไปก่อนแล้วค่อยสลับเป็นแบบสัมพัทธ์หลังหน้าโหลดเสร็จ
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

/** สีวงกลม avatar ต่อคน — วนตาม Token pastel เดิมที่มีอยู่แล้ว (ไม่เพิ่มสีใหม่) กำหนดจากชื่อแบบ deterministic คนเดิมได้สีเดิมเสมอ ไม่ต้องเก็บลง DB */
const AVATAR_PALETTE = [
  { bg: "bg-accent-soft", text: "text-accent" },
  { bg: "bg-pending-soft", text: "text-pending" },
  { bg: "bg-done-soft", text: "text-done" },
  { bg: "bg-primary-soft", text: "text-primary" },
  { bg: "bg-closed-soft", text: "text-closed" },
] as const;

/** เลือกหน้าตัวการ์ตูนแบบ minimal สำหรับ avatar (ดูรูปจริงที่ AvatarFace.tsx) — วนตามชื่อแบบ deterministic เหมือนสี ไม่ต้องเลือกเอง/ไม่ต้องเก็บลง DB (คนเดิม login กี่ครั้งก็ได้หน้าเดิมเสมอ) — ใช้ multiplier ต่างจาก avatarColorClasses เล็กน้อยกันสี/หน้าผูกกันตรงเกินไป */
export function avatarFaceVariant(name: string, faceCount: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 37 + name.charCodeAt(i)) >>> 0;
  return hash % faceCount;
}

export function avatarColorClasses(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
