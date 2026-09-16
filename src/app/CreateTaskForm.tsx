"use client";

import { useState, type FormEvent } from "react";
import type { Person, TaskInput } from "./board-types";

export function CreateTaskForm({
  owners,
  onCreate,
  onCancel,
}: {
  owners: Person[];
  onCreate: (input: TaskInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [ecmNumber, setEcmNumber] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      ecmNumber: ecmNumber.trim() || undefined,
      ownerId: ownerId || undefined,
      dueDate: dueDate || undefined,
      urgent,
      note: note.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3.5 grid grid-cols-1 gap-3 rounded-xl border-2 border-primary bg-primary-soft p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-[11.5px] font-medium text-muted">
          วาระ/เรื่อง <span className="text-pending">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='เช่น 4.1 (ลับ) ..."'
          required
          autoFocus
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] font-medium text-muted">ECM</label>
        <input
          value={ecmNumber}
          onChange={(e) => setEcmNumber(e.target.value)}
          placeholder="เลขที่ ECM (ถ้ามี)"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] font-medium text-muted">ผู้รับผิดชอบ</label>
        {owners.length === 0 ? (
          <span className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
            ยังไม่มีผู้ใช้ role Owner
          </span>
        ) : (
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">-- ยังไม่กำหนด --</option>
            {owners.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
        )}
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

      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary">
          บันทึก
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-muted hover:underline">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
