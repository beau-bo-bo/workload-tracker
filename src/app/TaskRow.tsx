"use client";

import { useId, useState, type FormEvent, type MouseEvent } from "react";
import { CheckIcon, EditIcon, RestoreIcon, TrashIcon } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { EMPTY_MARK, EMPTY_MARK_CLASS, formatLogDateTime, formatShortDate, personName, taskNeedsMyAction, taskProgress, taskStatusLabel, taskSteps, type PeopleIndex, type ProgressStep } from "./board-derived";
import { generateId, type ChecklistItem, type HistoryEntry, type Person, type Task, type TaskInput } from "./board-types";
import { needsSkippedReviewPrompt, type SkippedReviewChoice } from "./task-workflow";

export const TASK_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_3.25rem_4.75rem_2.25rem_1.75rem] items-center gap-1 sm:grid-cols-[minmax(0,22rem)_minmax(4.5rem,1fr)_minmax(7rem,1fr)_3rem_4rem] sm:gap-3 lg:grid-cols-[minmax(0,16rem)_5.5rem_8rem_3.5rem_4.5rem] lg:justify-between lg:gap-4";

const STATUS_PILL: Record<string, string> = {
  pending: "bg-pending-soft text-pending",
  done: "bg-done-soft text-done",
  closed: "bg-status-closed-soft text-status-closed",
};

function historyLabel(entry: HistoryEntry, people: PeopleIndex): string {
  // เปิดชื่อปัจจุบันจาก id ก่อน ถ้าเปิดไม่ได้ (ผู้ใช้ถูกลบ) ค่อยใช้ชื่อที่บันทึกไว้ ณ ตอนนั้น
  const owner = personName(people, entry.ownerId, entry.owner);
  const inspector = personName(people, entry.inspectorId, entry.inspector);
  switch (entry.action) {
    case "sent":
      return `${owner} (ผู้รับผิดชอบ) > ส่งตรวจ ${inspector}`.trim();
    case "reviewed":
      return `${inspector} > ตรวจแล้ว`.trim();
    case "closed":
      return `${owner} > ปิดงาน`.trim();
    case "reopened":
      return `${owner} > ย้อนสถานะ`.trim();
    // ข้อมูลประวัติมาจากฐานข้อมูลแบบ jsonb จึงอาจมี action ที่โค้ดรุ่นนี้ไม่รู้จัก
    // ต้องไม่คืนค่าว่างเพราะจะทำให้บรรทัดนั้นหายไปจากหน้าจอเงียบ ๆ
    default:
      return "การดำเนินการที่ไม่รู้จัก";
  }
}

export function TaskRow({
  task,
  owners,
  inspectors,
  people,
  canManageTasks,
  currentUserId,
  onDeleteTask,
  onEditTask,
  onSendForReview,
  onMarkReviewed,
  onCloseTask,
  onReopenTask,
  onAddHistoryNote,
}: {
  task: Task;
  owners: Person[];
  inspectors: Person[];
  /** รายชื่อผู้ใช้ทั้งระบบ ใช้เปิดชื่อจาก id (งานเก็บแต่ id ชื่อจึงตามการเปลี่ยนชื่อได้ทันที) */
  people: PeopleIndex;
  canManageTasks: boolean;
  currentUserId: string;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, input: TaskInput, checklist: ChecklistItem[], excludedAutoSteps: string[]) => void;
  onSendForReview: (taskId: string, inspector: string, message?: string, choice?: SkippedReviewChoice) => void | Promise<void>;
  onMarkReviewed: (taskId: string, message?: string) => void | Promise<void>;
  onCloseTask: (taskId: string, choice?: SkippedReviewChoice) => void | Promise<void>;
  onReopenTask: (taskId: string) => void | Promise<void>;
  onAddHistoryNote: (taskId: string, entryId: string, text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  /*
   * กันกดรัว (แก้ U5) — เดิมกดปุ่มแล้วหน้าจอนิ่งสนิทระหว่างรอเซิร์ฟเวอร์ (ราว 3 วินาที)
   * ผู้ใช้จึงกดซ้ำ แล้วได้ version_conflict ปลอม ๆ ทั้งที่ไม่มีใครมาแก้ชนจริง
   */
  const [busy, setBusy] = useState(false);
  const detailId = useId();
  const [activeModal, setActiveModal] = useState<"none" | "send" | "review" | "close">("none");
  const [selectedInspector, setSelectedInspector] = useState("");
  const [message, setMessage] = useState("");
  // งานยังค้างอยู่ที่ผู้ตรวจแต่เขาไม่ได้กด "ตรวจแล้ว" ในระบบ (ตรวจนอกระบบ) — ค่าเริ่มต้นเป็น "ตรวจแล้ว"
  // เพราะเป็นกรณีที่เกิดบ่อยกว่า ผู้ใช้จะได้กดผ่านได้เร็วโดยไม่ต้องเลือกทุกครั้ง
  const [markPreviousReviewed, setMarkPreviousReviewed] = useState(true);
  const [backdateNote, setBackdateNote] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const [title, setTitle] = useState(task.title);
  const [ecmNumber, setEcmNumber] = useState(task.ecmNumber ?? "");
  const [ownerId, setOwnerId] = useState(task.ownerId ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [urgent, setUrgent] = useState(task.urgent);
  const [note, setNote] = useState(task.note ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? []);
  const [excludedAutoSteps, setExcludedAutoSteps] = useState<string[]>(task.excludedAutoSteps ?? []);

  function startEdit(e: MouseEvent) {
    e.stopPropagation();
    setTitle(task.title);
    setEcmNumber(task.ecmNumber ?? "");
    setOwnerId(task.ownerId ?? "");
    setDueDate(task.dueDate ?? "");
    setUrgent(task.urgent);
    setNote(task.note ?? "");
    setChecklist(task.checklist ?? []);
    setExcludedAutoSteps(task.excludedAutoSteps ?? []);
    setAddingStep(false);
    setStepLabel("");
    setEditing(true);
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onEditTask(
      task.id,
      {
        title: title.trim(),
        ecmNumber: ecmNumber.trim() || undefined,
        ownerId: ownerId || undefined,
        dueDate: dueDate || undefined,
        urgent,
        note: note.trim() || undefined,
      },
      checklist,
      excludedAutoSteps
    );
    setEditing(false);
  }

  async function runAction(fn: () => void | Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  function removeAutoStep(stepKey: string) {
    setExcludedAutoSteps((prev) => [...prev, stepKey]);
  }

  function openModal(modal: "send" | "review" | "close") {
    setSelectedInspector("");
    setMessage("");
    setMarkPreviousReviewed(true);
    setBackdateNote("");
    setActiveModal(modal);
  }

  /** คำตอบเรื่อง "ผู้ตรวจคนเดิมตรวจแล้วหรือยัง" — ส่งไปก็ต่อเมื่องานยังค้างอยู่ที่ผู้ตรวจจริง ๆ */
  function skippedReviewChoice(): SkippedReviewChoice | undefined {
    if (!needsSkippedReviewPrompt(task)) return undefined;
    return { markPreviousReviewed, note: backdateNote.trim() || undefined };
  }

  /** ตัวเลือกที่ใช้ร่วมกันทั้ง modal "ส่งตรวจ" และ "ปิดงาน" */
  function backdatedReviewFields() {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
        <p className="text-xs text-text">
          งานนี้ยังค้างอยู่ที่ <span className="font-bold">{inspectorName}</span>{" "}
          <span className="text-muted">(ยังไม่ได้กด &quot;ตรวจแล้ว&quot; ในระบบ)</span>
        </p>
        {[
          { value: true, label: `${inspectorName} ตรวจแล้ว — บันทึกย้อนหลังให้ด้วย` },
          { value: false, label: `${inspectorName} ยังไม่ได้ตรวจ — ไม่ต้องบันทึก` },
        ].map((option) => (
          <label key={String(option.value)} className="flex items-start gap-2 text-xs text-text">
            <input
              type="radio"
              name={`backdate-${task.id}`}
              checked={markPreviousReviewed === option.value}
              onChange={() => setMarkPreviousReviewed(option.value)}
              className="mt-0.5 h-3.5 w-3.5 flex-none accent-accent"
            />
            <span>{option.label}</span>
          </label>
        ))}
        {markPreviousReviewed && (
          <input
            value={backdateNote}
            onChange={(e) => setBackdateNote(e.target.value)}
            placeholder="หมายเหตุ (ถ้ามี) เช่น ผบ. แจ้งทางไลน์ 15 ก.ย."
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
          />
        )}
      </div>
    );
  }

  function closeModal() {
    setActiveModal("none");
  }

  function addChecklistItem() {
    const label = stepLabel.trim();
    if (!label) return;
    setChecklist((prev) => [...prev, { id: generateId(), label, done: false }]);
    setStepLabel("");
    setAddingStep(false);
  }

  function toggleChecklistItem(itemId: string) {
    setChecklist((prev) => prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)));
  }

  function removeChecklistItem(itemId: string) {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  }

  const ownerName = personName(people, task.ownerId);
  const inspectorName = personName(people, task.inspectorId);

  const steps = taskSteps(task, inspectors, people);
  const progress = taskProgress(steps);
  const closeStep = steps[steps.length - 1];

  const allSteps = taskSteps({ ...task, excludedAutoSteps: [] }, inspectors, people);
  const editableReviewSteps = allSteps
    .filter((step) => step.auto && step.key !== "closed")
    .filter((step) => !excludedAutoSteps.includes(step.key));

  function autoStepRow(step: ProgressStep, onRemove?: () => void) {
    return (
      <div key={step.key} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 opacity-60">
        <span
          className={`flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full border ${
            step.done ? "border-done bg-done text-white" : "border-border text-transparent"
          }`}
        >
          <CheckIcon className="h-3 w-3" />
        </span>
        <span className={`flex-1 text-xs ${step.done ? "text-muted line-through" : "text-text"}`}>
          {step.label}
        </span>
        <span className="text-[11px] text-muted">อัตโนมัติ</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[11px] text-muted hover:text-pending">
            ลบ
          </button>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-bg px-3 py-3">
        <form onSubmit={saveEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11.5px] font-medium text-muted">วาระ/เรื่อง</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-medium text-muted">ECM</label>
            <input
              value={ecmNumber}
              onChange={(e) => setEcmNumber(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-medium text-muted">ผู้รับผิดชอบ</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            >
              <option value="">-- ยังไม่กำหนด --</option>
              {owners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-medium text-muted">วันครบกำหนด</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11.5px] font-medium text-muted">ด่วน</label>
            <button
              type="button"
              role="switch"
              aria-checked={urgent}
              onClick={() => setUrgent((u) => !u)}
              className={`flex h-9 w-fit items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm ${
                urgent ? "text-pending" : "text-muted"
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors ${
                  urgent ? "bg-pending" : "bg-closed-soft"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    urgent ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              {urgent ? "ด่วน 🔥" : "ไม่ด่วน"}
            </button>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11.5px] font-medium text-muted">หมายเหตุเพิ่มเติม</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:col-span-2">
            <label className="text-[11.5px] font-medium text-muted">ขั้นตอนที่ track (ความคืบหน้า)</label>

            <div className="flex flex-col gap-1">
              {editableReviewSteps.map((step) => autoStepRow(step, () => removeAutoStep(step.key)))}

              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full border transition-colors ${
                      item.done ? "border-done bg-done text-white" : "border-border text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-3 w-3" />
                  </button>
                  <span className={`flex-1 text-xs ${item.done ? "text-muted line-through" : "text-text"}`}>
                    {item.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(item.id)}
                    className="text-[11px] text-muted hover:text-pending"
                  >
                    ลบ
                  </button>
                </div>
              ))}

              {autoStepRow(closeStep)}
            </div>

            {addingStep ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={stepLabel}
                  onChange={(e) => setStepLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                  placeholder="เช่น ECM มาแล้ว"
                  className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-on-primary"
                >
                  เพิ่ม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingStep(false);
                    setStepLabel("");
                  }}
                  className="text-[11px] text-muted hover:underline"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingStep(true)}
                className="self-start text-[11px] font-medium text-muted/70 hover:text-text"
              >
                + เพิ่มขั้นตอน
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary">
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium text-muted hover:underline"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    );
  }

  const shortDate = formatShortDate(task.dueDate);
  const canSend = task.status === "blank" || task.status === "done" || task.status === "pending";
  const canReview = task.status === "pending";
  const needsMyAction = taskNeedsMyAction(task, currentUserId);

  return (
    <div className={`rounded-xl border bg-bg ${needsMyAction ? "border-pending" : "border-border"}`}>
      <div
        className={`${TASK_ROW_GRID} cursor-pointer px-2 py-2 hover:bg-closed-soft/30 sm:px-3 sm:py-2.5 lg:px-4 lg:py-3.5`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/*
          a11y (แก้ U8): เดิมทั้งแถวเป็น div + onClick → กด Tab ไม่ถึง กด Enter ไม่ได้ และโปรแกรมอ่านหน้าจอไม่รู้ว่ากดขยายได้
          ทำเฉพาะ "ชื่อวาระ" ให้เป็นปุ่มจริง (ครอบทั้งแถวเป็นปุ่มไม่ได้ เพราะมีปุ่มลบอยู่ข้างใน — ปุ่มซ้อนปุ่มเป็น HTML ที่ผิด)
          คนใช้เมาส์ยังคลิกที่ไหนก็ได้ในแถวเหมือนเดิม
        */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="min-w-0 cursor-pointer text-left text-[12.5px] leading-snug font-bold break-words text-text sm:text-[13px] lg:text-[15px]"
        >
          {task.title}
        </button>
        <div className="flex justify-center">
          <span className="inline-flex h-6 w-11 flex-none items-center justify-center whitespace-nowrap rounded-md bg-closed-soft px-1 text-[11.5px] font-semibold text-text sm:h-7 sm:w-16 sm:text-[11.5px] lg:h-8 lg:w-[4.5rem] lg:text-[12.5px]">
            {ownerName || <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>}
          </span>
        </div>
        <div className="text-center">
          {task.status === "blank" ? (
            <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>
          ) : (
            <span
              className={`whitespace-nowrap rounded-full px-1 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-[11.5px] lg:px-3 lg:py-1 lg:text-[13px] ${STATUS_PILL[task.status]}`}
            >
              {taskStatusLabel(task, people)}
            </span>
          )}
        </div>
        <div className="text-center">
          {!task.urgent && !shortDate ? (
            <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>
          ) : (
            <div className="flex flex-col items-center leading-tight">
              {task.urgent && <span>🔥</span>}
              {shortDate && <span className="text-[11px] whitespace-nowrap text-pending lg:text-[11px]">{shortDate}</span>}
            </div>
          )}
        </div>
        <div
          className="flex flex-col items-end justify-self-end gap-1 sm:flex-row sm:items-center sm:gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {canManageTasks && (
            <button
              type="button"
              title="ลบ"
              onClick={() => {
                if (confirm(`ลบ "${task.title}" ใช่หรือไม่? (จะถูกย้ายไปที่ถังขยะ)`)) {
                  onDeleteTask(task.id);
                }
              }}
              className="inline-flex items-center justify-center rounded-md p-1 text-pending hover:bg-pending-soft lg:p-1.5"
            >
              <TrashIcon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          id={detailId}
          className="flex flex-col gap-3 border-t border-border px-3 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          {canManageTasks && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-muted/70 hover:bg-closed-soft hover:text-text"
              >
                <EditIcon className="h-3 w-3" />
                แก้ไขข้อมูล
              </button>
            </div>
          )}

          {(task.ecmNumber || task.note) && (
            <div className="flex flex-col gap-2">
              {task.ecmNumber && (
                <div className="flex items-start gap-2 rounded-lg bg-note-soft px-3 py-2 text-xs">
                  <span className="flex-none">📌</span>
                  <span>
                    <span className="font-medium text-muted">ECM: </span>
                    <span className="text-text">{task.ecmNumber}</span>
                  </span>
                </div>
              )}
              {task.note && (
                <div className="flex items-start gap-2 rounded-lg bg-note-soft px-3 py-2 text-xs">
                  <span className="flex-none">📌</span>
                  <span>
                    <span className="font-medium text-muted">หมายเหตุ: </span>
                    <span className="text-text">{task.note}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {task.status === "closed" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => onReopenTask(task.id))}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-closed-soft px-3.5 py-2 text-xs font-bold text-closed hover:opacity-80 disabled:cursor-progress disabled:opacity-50"
            >
              <RestoreIcon className="h-3.5 w-3.5" />
              {busy ? "กำลังบันทึก..." : "ย้อนสถานะเพื่อดำเนินต่อ"}
            </button>
          ) : (
            <div className="flex w-full gap-2">
              <button
                type="button"
                disabled={!canSend || busy}
                onClick={() => openModal("send")}
                className={`flex-1 rounded-full bg-pending-soft px-3 py-2 text-center text-[11px] font-bold text-pending transition-opacity ${
                  canSend && !busy ? "hover:opacity-80" : "cursor-not-allowed opacity-35"
                }`}
              >
                ส่งตรวจ
              </button>
              <button
                type="button"
                disabled={!canReview || busy}
                onClick={() => openModal("review")}
                className={`flex-1 rounded-full bg-done-soft px-3 py-2 text-center text-[11px] font-bold text-done transition-opacity ${
                  canReview && !busy ? "hover:opacity-80" : "cursor-not-allowed opacity-35"
                }`}
              >
                ตรวจแล้ว
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  needsSkippedReviewPrompt(task) ? openModal("close") : runAction(() => onCloseTask(task.id))
                }
                className="flex-1 rounded-full bg-status-closed-soft px-3 py-2 text-center text-[11px] font-bold text-status-closed transition-opacity hover:opacity-80 disabled:cursor-progress disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "ปิดงาน"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">ความคืบหน้า</p>
              <span className="text-[11px] font-bold text-done">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-closed-soft">
              <div className="h-full rounded-full bg-done transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="border-t border-border pt-2.5">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Timeline</p>
            {task.history && task.history.length > 0 ? (
              <div className="relative flex flex-col gap-3 pl-4">
                <div className="absolute top-1.5 bottom-1.5 left-[3px] w-px bg-border" />
                {[...task.history].reverse().map((entry, i) => (
                  <div key={entry.id} className="relative">
                    <span className="absolute top-1.5 -left-4 h-[7px] w-[7px] rounded-full bg-accent" />
                    <div className="rounded-lg bg-closed-soft/50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-text">
                          {historyLabel(entry, people)}
                          {/* แยกให้ออกว่าผู้ตรวจกดเอง หรือมีคนบันทึกแทนภายหลัง — สำคัญเวลาตรวจสอบย้อนหลัง */}
                          {entry.recordedBy && (
                            <span className="ml-1 font-normal text-muted">
                              (บันทึกย้อนหลังโดย {entry.recordedBy})
                            </span>
                          )}
                        </p>
                        {i === 0 && addingNoteFor !== entry.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingNoteFor(entry.id);
                              setNoteDraft("");
                            }}
                            className="flex-none rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap text-on-primary"
                          >
                            + เพิ่มหมายเหตุ
                          </button>
                        )}
                      </div>
                      {entry.message && (
                        <div className="mt-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text">
                          "{entry.message}"
                        </div>
                      )}
                      {entry.notes?.map((note) => (
                        <div
                          key={note.id}
                          className="mt-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text"
                        >
                          <p>"{note.text}"</p>
                          <p className="mt-1 text-right text-[11px] text-muted">{formatLogDateTime(note.at)}</p>
                        </div>
                      ))}
                      {addingNoteFor === entry.id && (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <textarea
                            autoFocus
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            rows={2}
                            placeholder="เพิ่มหมายเหตุ..."
                            className="resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
                          />
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = noteDraft.trim();
                                if (!trimmed) return;
                                onAddHistoryNote(task.id, entry.id, trimmed);
                                setAddingNoteFor(null);
                              }}
                              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary"
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingNoteFor(null)}
                              className="text-[11px] font-medium text-muted hover:underline"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="mt-1.5 text-right text-[11.5px] text-muted">{formatLogDateTime(entry.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted">
                ยังไม่มีการดำเนินการ
              </div>
            )}
          </div>
        </div>
      )}

      {activeModal === "send" && (
        <Modal title="ส่งต่องาน (ส่งตรวจ)" onClose={closeModal}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">มอบหมายให้</label>
            {inspectors.length === 0 ? (
              <p className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted">
                ยังไม่มีผู้ใช้ role Inspector
              </p>
            ) : (
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
              >
                <option value="">-- เลือกผู้ตรวจ --</option>
                {inspectors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
          {needsSkippedReviewPrompt(task) && backdatedReviewFields()}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">บันทึกช่วยจำ / Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="เพิ่มรายละเอียดงาน..."
              className="resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center justify-end gap-4">
            <button type="button" onClick={closeModal} className="text-xs font-medium text-muted hover:underline">
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={!selectedInspector || busy}
              onClick={() =>
                runAction(async () => {
                  const choice = skippedReviewChoice();
                  const note = message.trim() || undefined;
                  const inspector = selectedInspector;
                  closeModal();
                  await onSendForReview(task.id, inspector, note, choice);
                })
              }
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยันส่งตรวจ"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "close" && (
        <Modal title="ปิดงาน" onClose={closeModal}>
          {backdatedReviewFields()}
          <div className="flex items-center justify-end gap-4">
            <button type="button" onClick={closeModal} className="text-xs font-medium text-muted hover:underline">
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(async () => {
                  const choice = skippedReviewChoice();
                  closeModal();
                  await onCloseTask(task.id, choice);
                })
              }
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยันปิดงาน"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "review" && (
        <Modal title="ส่งต่องาน (ตรวจแล้ว)" onClose={closeModal}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">ส่งคืนผู้รับผิดชอบ</label>
            <p className="rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-text">
              {ownerName}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">บันทึกช่วยจำ / Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="เพิ่มรายละเอียดงาน..."
              className="resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center justify-end gap-4">
            <button type="button" onClick={closeModal} className="text-xs font-medium text-muted hover:underline">
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(async () => {
                  const note = message.trim() || undefined;
                  closeModal();
                  await onMarkReviewed(task.id, note);
                })
              }
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยัน (ตรวจแล้ว)"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

