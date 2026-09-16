"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import type { BoardPost, BoardPostInput, Person } from "./board-types";

export function CreateBoardPostForm({
  allUsers,
  editingPost,
  onCreate,
  onCancel,
}: {
  allUsers: Person[];
  editingPost?: BoardPost;
  onCreate: (input: BoardPostInput) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(editingPost?.body ?? "");
  const [reminderDate, setReminderDate] = useState(editingPost?.reminderDate ?? "");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(editingPost?.taggedUserIds ?? []);

  function toggleTag(id: string) {
    setTaggedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    onCreate({
      body: body.trim(),
      reminderDate: reminderDate || undefined,
      taggedUserIds,
    });
  }

  return (
    <Modal title={editingPost ? "Edit Memo" : "New Memo"} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11.5px] font-medium text-muted">
            Message <span className="text-pending">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='e.g. "Don&apos;t forget tomorrow..." or "On [date], need to..."'
            required
            autoFocus
            rows={3}
            className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11.5px] font-medium text-muted">Tag people (multiple allowed)</label>
          {allUsers.length === 0 ? (
            <span className="text-xs text-muted">No users found</span>
          ) : (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-2">
              {allUsers.map((person) => {
                const active = taggedUserIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleTag(person.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      active ? "bg-accent-soft text-accent" : "bg-closed-soft text-muted hover:text-text"
                    }`}
                  >
                    {person.displayName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11.5px] font-medium text-muted">Reminder date (optional)</label>
          <input
            type="date"
            value={reminderDate}
            onChange={(e) => setReminderDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary">
            Save
          </button>
          <button type="button" onClick={onCancel} className="text-xs font-medium text-muted hover:underline">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
