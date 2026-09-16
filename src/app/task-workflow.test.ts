import { describe, expect, it } from "vitest";
import {
  buildCloseTransition,
  buildReopenTransition,
  buildReviewTransition,
  buildSendTransition,
  needsSkippedReviewPrompt,
  type Actor,
  type WorkflowPatch,
} from "./task-workflow";
import type { Task } from "./board-types";

const OWNER: Actor = { id: "u-owner", displayName: "สมชาย" };
const A = { id: "u-a", displayName: "คุณเอ" };
const B = { id: "u-b", displayName: "คุณบี" };
const clock = () => "2026-09-15T10:00:00.000Z";

function newTask(): Task {
  return {
    id: "t1",
    meetingId: "m1",
    title: "วาระทดสอบ",
    ownerId: OWNER.id,
    status: "blank",
    urgent: false,
    history: [],
    checklist: [],
    excludedAutoSteps: [],
    sortOrder: 1,
    version: 1,
  };
}

/** จำลองการกดปุ่มจริงจากหน้าจอ: เอา patch ที่ได้ไปทับลงงานเหมือนที่ AppShell ทำ */
function apply(task: Task, patch: WorkflowPatch): Task {
  return { ...task, status: patch.status, inspectorId: patch.inspectorId, history: patch.history };
}

const send = (t: Task, to: typeof A, markPreviousReviewed = false) =>
  apply(
    t,
    buildSendTransition(
      t,
      {
        inspectorId: to.id,
        newInspectorName: to.displayName,
        ownerName: OWNER.displayName,
        actor: OWNER,
        choice: { markPreviousReviewed },
      },
      clock
    )
  );
const review = (t: Task) => apply(t, buildReviewTransition(t, {}, clock));
const close = (t: Task, markPreviousReviewed = false) =>
  apply(t, buildCloseTransition(t, { actor: OWNER, choice: { markPreviousReviewed } }, clock));
const reopen = (t: Task) => apply(t, buildReopenTransition(t));
const actions = (t: Task) => t.history.map((h) => h.action);

describe("ถามก่อนบันทึกย้อนหลัง", () => {
  it("ถามเฉพาะตอนงานยังค้างอยู่ที่ผู้ตรวจ", () => {
    expect(needsSkippedReviewPrompt(newTask())).toBe(false);
    expect(needsSkippedReviewPrompt(send(newTask(), A))).toBe(true);
    expect(needsSkippedReviewPrompt(review(send(newTask(), A)))).toBe(false);
  });

  it('ตอบว่า "ตรวจแล้ว" → บันทึกให้พร้อมกำกับว่าใครบันทึกแทน', () => {
    const backdated = close(send(newTask(), A), true).history.find((h) => h.action === "reviewed");

    expect(backdated).toBeDefined();
    expect(backdated?.inspectorId).toBe(A.id);
    expect(backdated?.recordedBy).toBe(OWNER.displayName);
  });

  it('ตอบว่า "ยังไม่ได้ตรวจ" → ไม่เขียนอะไรเพิ่มให้', () => {
    expect(actions(close(send(newTask(), A), false))).toEqual(["sent", "closed"]);
  });

  it("ผู้ตรวจกดเองในระบบ → ต้องไม่มี recordedBy ติดมา (แยกให้ออกว่าใครกดเอง)", () => {
    expect(review(send(newTask(), A)).history.at(-1)?.recordedBy).toBeUndefined();
  });

  it("เก็บหมายเหตุที่ผู้ใช้กรอกตอนบันทึกย้อนหลังไว้ด้วย", () => {
    const patch = buildCloseTransition(
      send(newTask(), A),
      { actor: OWNER, choice: { markPreviousReviewed: true, note: "ผบ. แจ้งทางไลน์" } },
      clock
    );
    expect(patch.history.find((h) => h.action === "reviewed")?.message).toBe("ผบ. แจ้งทางไลน์");
  });
});

describe("ย้อนสถานะ ต้องกลับไปยังสถานะก่อนปิดงานเสมอ", () => {
  it("เส้นทางปกติ: ส่งตรวจ A → A ตรวจแล้ว → ปิดงาน → ย้อนสถานะ", () => {
    const t = reopen(close(review(send(newTask(), A))));
    expect(t.status).toBe("done");
    expect(actions(t)).toEqual(["sent", "reviewed"]);
  });

  it("ปิดงานตั้งแต่ยังไม่เคยส่งตรวจ → ย้อนสถานะ กลับไปว่างเปล่า", () => {
    const t = reopen(close(newTask()));
    expect(t.status).toBe("blank");
    expect(t.history).toEqual([]);
  });

  it('ส่งตรวจ A → ปิดงานเลย โดยตอบว่า "ยังไม่ได้ตรวจ" → ต้องกลับไปเป็น "รอ A ตรวจ"', () => {
    const t = reopen(close(send(newTask(), A), false));
    expect(t.status).toBe("pending");
    expect(t.inspectorId).toBe(A.id);
    expect(actions(t)).toEqual(["sent"]);
  });

  it('ส่งตรวจ A → ปิดงานเลย โดยตอบว่า "ตรวจแล้ว" → กลับไปเป็น "A ตรวจแล้ว" พร้อมประวัติที่กำกับไว้', () => {
    const t = reopen(close(send(newTask(), A), true));
    expect(t.status).toBe("done");
    expect(actions(t)).toEqual(["sent", "reviewed"]);
    expect(t.history.at(-1)?.recordedBy).toBe(OWNER.displayName);
  });

  it("ส่งตรวจซ้ำไปคนที่สอง แล้วปิดงาน → ย้อนสถานะกลับไปค้างที่คนที่สอง", () => {
    const t = reopen(close(send(send(newTask(), A), B, true), false));
    expect(t.status).toBe("pending");
    expect(t.inspectorId).toBe(B.id);
    expect(actions(t)).toEqual(["sent", "reviewed", "sent"]);
  });
});

describe("ส่งตรวจซ้ำ", () => {
  it("ไม่ว่าตอบแบบไหน สถานะสุดท้ายต้องเป็นรอผู้ตรวจคนใหม่เหมือนกัน", () => {
    const withRecord = send(send(newTask(), A), B, true);
    const withoutRecord = send(send(newTask(), A), B, false);

    expect(withRecord.status).toBe("pending");
    expect(withoutRecord.status).toBe("pending");
    expect(withRecord.inspectorId).toBe(B.id);
    expect(withoutRecord.inspectorId).toBe(B.id);

    // ต่างกันแค่บรรทัดใน Timeline เท่านั้น
    expect(actions(withRecord)).toEqual(["sent", "reviewed", "sent"]);
    expect(actions(withoutRecord)).toEqual(["sent", "sent"]);
  });
});

describe("ผูกคนด้วยรหัสประจำตัว ไม่ใช่ชื่อ (ข้อ 5 / B5)", () => {
  it("งานและประวัติต้องอ้างถึงคนด้วย id เสมอ — เปลี่ยนชื่อคนแล้วงานจะได้ไม่ขาดจากเขา", () => {
    const t = close(send(newTask(), A), true);

    expect(t.ownerId).toBe(OWNER.id);
    expect(t.inspectorId).toBe(A.id);
    for (const entry of t.history) {
      // ทุกบรรทัดที่อ้างถึงคน ต้องมี id กำกับ ไม่ใช่มีแต่ชื่อ
      if (entry.inspector) expect(entry.inspectorId).toBeTruthy();
      if (entry.owner) expect(entry.ownerId).toBeTruthy();
    }
  });
});
