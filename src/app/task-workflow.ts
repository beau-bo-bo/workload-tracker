import { generateId, type HistoryEntry, type Task, type TaskStatus } from "./board-types";

/** ฟิลด์ที่ต้องส่งไปอัปเดตงานหลังเปลี่ยนสถานะ 1 ครั้ง */
export type WorkflowPatch = {
  status: TaskStatus;
  inspectorId?: string;
  history: HistoryEntry[];
};

/**
 * คำตอบของผู้ใช้จาก dialog ที่ขึ้นเมื่อสั่งงานต่อทั้งที่งานยังค้างอยู่ที่ผู้ตรวจ
 *
 * บริบท: ในการทำงานจริง ผู้บังคับบัญชามักตรวจเอกสารเรียบร้อยแล้วแต่ไม่ได้กดปุ่ม "ตรวจแล้ว" ในระบบ
 * (ตรวจนอกระบบ) เจ้าของงานจึงกดปิดงานเลย และต้องการให้ระบบบันทึกว่าผ่านการตรวจแล้วจริง
 */
export type SkippedReviewChoice = {
  /** true = ผู้ตรวจคนเดิมตรวจแล้วจริง ให้บันทึกย้อนหลังให้ด้วย */
  markPreviousReviewed: boolean;
  /** หมายเหตุประกอบ เช่น "ผบ. ตรวจแล้วแจ้งทางไลน์ 15 ก.ย." */
  note?: string;
};

/** คนที่กดปุ่ม — เก็บทั้ง id (ไว้จับคู่) และชื่อ (ไว้แสดงในประวัติ) */
export type Actor = { id: string; displayName: string };

/** ชื่อของคนที่เกี่ยวข้องกับ transaction นี้ ผู้เรียกเป็นคนเปิดชื่อจาก id มาให้ */
type PersonNames = { ownerName?: string; inspectorName?: string };

type Clock = () => string;
const systemClock: Clock = () => new Date().toISOString();

/** งานยังค้างอยู่ที่ผู้ตรวจหรือไม่ — ใช้ตัดสินว่าต้องถามผู้ใช้ก่อนสั่งงานต่อไหม */
export function needsSkippedReviewPrompt(task: Task): boolean {
  return task.status === "pending";
}

/**
 * บันทึกย้อนหลังว่าผู้ตรวจคนเดิมตรวจแล้ว
 *
 * เดิมระบบเขียน entry นี้ให้เองเงียบ ๆ ทุกครั้งที่สั่งงานต่อจากสถานะ pending ซึ่งทำให้เกิดปัญหา 2 อย่าง:
 *   1. ประวัติมีบรรทัด "ตรวจแล้ว" ที่ผู้ใช้ไม่ได้สั่ง และแยกไม่ออกจากตอนที่ผู้ตรวจกดเอง
 *   2. ตอนกด "ย้อนสถานะ" ระบบถอด entry ออกแค่ 1 บรรทัด ทั้งที่ตอนปิดงานเพิ่มไป 2 บรรทัด
 *      → สถานะที่ได้กลับมาเพี้ยนไป 1 ขั้น (ได้ "ตรวจแล้ว" ทั้งที่ควรเป็น "รอตรวจ")
 *
 * ตอนนี้เขียนก็ต่อเมื่อผู้ใช้ยืนยันเท่านั้น และกำกับ recordedBy ไว้เสมอว่าใครเป็นคนบันทึกแทน
 * ผลพลอยได้: จำนวน entry ที่เพิ่มตรงกับที่ buildReopenTransition ถอดออกพอดีทั้งสองทาง ปัญหาข้อ 2 จึงหมดไปเอง
 */
function backdatedReviewEntry(
  task: Task,
  actor: Actor,
  inspectorName: string | undefined,
  note: string | undefined,
  clock: Clock
): HistoryEntry {
  return {
    id: generateId(),
    action: "reviewed",
    inspectorId: task.inspectorId,
    inspector: inspectorName,
    message: note?.trim() || undefined,
    recordedBy: actor.displayName,
    at: clock(),
  };
}

function withOptionalBackdatedReview(
  task: Task,
  choice: SkippedReviewChoice | undefined,
  actor: Actor,
  inspectorName: string | undefined,
  clock: Clock
): HistoryEntry[] {
  const history = task.history ?? [];
  if (!needsSkippedReviewPrompt(task) || !choice?.markPreviousReviewed) return history;
  return [...history, backdatedReviewEntry(task, actor, inspectorName, choice.note, clock)];
}

/** ส่งตรวจ — งานย้ายไปรอที่ผู้ตรวจคนใหม่ */
export function buildSendTransition(
  task: Task,
  input: {
    inspectorId: string;
    newInspectorName?: string;
    message?: string;
    choice?: SkippedReviewChoice;
    actor: Actor;
  } & PersonNames,
  clock: Clock = systemClock
): WorkflowPatch {
  const base = withOptionalBackdatedReview(task, input.choice, input.actor, input.inspectorName, clock);
  return {
    status: "pending",
    inspectorId: input.inspectorId,
    history: [
      ...base,
      {
        id: generateId(),
        action: "sent",
        ownerId: task.ownerId,
        owner: input.ownerName,
        inspectorId: input.inspectorId,
        inspector: input.newInspectorName,
        message: input.message,
        at: clock(),
      },
    ],
  };
}

/** ผู้ตรวจกด "ตรวจแล้ว" เองในระบบ — ไม่มีการบันทึกย้อนหลัง จึงไม่ต้องถามอะไร */
export function buildReviewTransition(
  task: Task,
  input: { message?: string } & PersonNames = {},
  clock: Clock = systemClock
): WorkflowPatch {
  return {
    status: "done",
    inspectorId: task.inspectorId,
    history: [
      ...(task.history ?? []),
      {
        id: generateId(),
        action: "reviewed",
        inspectorId: task.inspectorId,
        inspector: input.inspectorName,
        message: input.message,
        at: clock(),
      },
    ],
  };
}

/** ปิดงาน — ถ้างานยังค้างที่ผู้ตรวจ ผู้ใช้ต้องตอบก่อนว่าผู้ตรวจตรวจแล้วหรือยัง */
export function buildCloseTransition(
  task: Task,
  input: { choice?: SkippedReviewChoice; actor: Actor } & PersonNames,
  clock: Clock = systemClock
): WorkflowPatch {
  const base = withOptionalBackdatedReview(task, input.choice, input.actor, input.inspectorName, clock);
  return {
    status: "closed",
    inspectorId: task.inspectorId,
    history: [
      ...base,
      { id: generateId(), action: "closed", ownerId: task.ownerId, owner: input.ownerName, at: clock() },
    ],
  };
}

const RESUMES_AS_DONE: readonly string[] = ["reviewed", "reopened", "closed"];

/** ย้อนสถานะ — ถอดการกระทำล่าสุดออก 1 ครั้ง แล้วกลับไปยังสถานะก่อนหน้า */
export function buildReopenTransition(task: Task): WorkflowPatch {
  const history = (task.history ?? []).slice(0, -1);
  const last = history[history.length - 1];
  const status: TaskStatus = !last
    ? "blank"
    : RESUMES_AS_DONE.includes(last.action)
      ? "done"
      : last.action === "sent"
        ? "pending"
        : "blank";
  return { status, inspectorId: task.inspectorId, history };
}

/** เพิ่มหมายเหตุเข้าไปในรายการประวัติที่มีอยู่แล้ว โดยไม่เปลี่ยนสถานะงาน */
export function buildAddNoteTransition(
  task: Task,
  input: { entryId: string; text: string },
  clock: Clock = systemClock
): WorkflowPatch {
  const note = { id: generateId(), text: input.text, at: clock() };
  return {
    status: task.status,
    inspectorId: task.inspectorId,
    history: (task.history ?? []).map((h) =>
      h.id === input.entryId ? { ...h, notes: [...(h.notes ?? []), note] } : h
    ),
  };
}
