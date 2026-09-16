"use client";

import { useState, type FormEvent } from "react";
import { ArchiveIcon, EditIcon } from "@/components/icons";
import { meetingStatusLabel, taskWorkload } from "./board-derived";
import type { ChecklistItem, Meeting, Person, TaskInput } from "./board-types";
import type { SkippedReviewChoice } from "./task-workflow";
import type { PeopleIndex } from "./board-derived";
import { CreateTaskForm } from "./CreateTaskForm";
import { TaskTable } from "./TaskTable";

export function MeetingCard({
  meeting,
  owners,
  inspectors,
  people,
  canManageTasks,
  currentUserId,
  onArchive,
  onEditDetails,
  onCreateTask,
  onDeleteTask,
  onEditTask,
  onSendForReview,
  onMarkReviewed,
  onCloseTask,
  onReopenTask,
  onAddHistoryNote,
}: {
  meeting: Meeting;
  owners: Person[];
  inspectors: Person[];
  people: PeopleIndex;
  canManageTasks: boolean;
  currentUserId: string;
  onArchive: (meetingId: string) => void;
  onEditDetails: (meetingId: string, title: string, timeline: string) => void;
  onCreateTask: (meetingId: string, input: TaskInput) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, input: TaskInput, checklist: ChecklistItem[], excludedAutoSteps: string[]) => void;
  onSendForReview: (taskId: string, inspector: string, message?: string, choice?: SkippedReviewChoice) => void;
  onMarkReviewed: (taskId: string, message?: string) => void;
  onCloseTask: (taskId: string, choice?: SkippedReviewChoice) => void;
  onReopenTask: (taskId: string) => void;
  onAddHistoryNote: (taskId: string, entryId: string, text: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meeting.title);
  const [timelineDraft, setTimelineDraft] = useState(meeting.timeline ?? "");
  const workload = taskWorkload(meeting.tasks, inspectors);

  function startEditDetails() {
    setTitleDraft(meeting.title);
    setTimelineDraft(meeting.timeline ?? "");
    setEditingDetails(true);
  }

  function saveDetails(e: FormEvent) {
    e.preventDefault();
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    onEditDetails(meeting.id, trimmed, timelineDraft.trim());
    setEditingDetails(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-5 lg:p-6">
      {editingDetails ? (
        <form onSubmit={saveDetails} className="flex flex-col gap-2">
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            required
            placeholder="ชื่อครั้งที่ประชุม"
            className="min-w-0 rounded-lg border border-border bg-bg px-2.5 py-1.5 font-display text-lg font-semibold text-text outline-none focus:border-accent"
          />
          <input
            value={timelineDraft}
            onChange={(e) => setTimelineDraft(e.target.value)}
            placeholder="รายละเอียด (ถ้ามี)"
            className="min-w-0 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
          />
          <div className="flex items-center gap-3">
            <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary">
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setEditingDetails(false)}
              className="text-xs font-medium text-muted hover:underline"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="mr-1 min-w-0 truncate font-display text-lg font-semibold text-text lg:text-xl">{meeting.title}</h2>
            {canManageTasks && (
              <>
                <button
                  type="button"
                  title="แก้ไขข้อมูล"
                  onClick={startEditDetails}
                  className="inline-flex flex-none items-center justify-center rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  title="ย้ายไปที่เก็บ"
                  onClick={() => {
                    if (confirm(`ย้าย "${meeting.title}" ไปที่เก็บใช่หรือไม่? (จะถูกย้ายไปที่ถังขยะ กู้คืนได้ภายหลัง)`)) onArchive(meeting.id);
                  }}
                  className="inline-flex flex-none items-center justify-center rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text"
                >
                  <ArchiveIcon />
                </button>
              </>
            )}
          </div>
          <div className="flex flex-none items-center gap-1.5 sm:gap-2 lg:gap-2.5">
            <span className="rounded-full bg-closed-soft px-2 py-1 text-[11px] font-medium whitespace-nowrap text-muted sm:px-3 sm:py-1.5 sm:text-xs lg:px-3.5 lg:py-2 lg:text-[13px]">
              {meetingStatusLabel(meeting)}
            </span>
            {canManageTasks && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-on-primary sm:px-3.5 sm:py-2 sm:text-xs lg:px-4 lg:py-2.5 lg:text-[13px]"
              >
                + เพิ่มเรื่อง
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-3.5 flex flex-col gap-1.5 lg:mt-4 lg:gap-2">
        {!editingDetails && meeting.timeline && (
          <div className="text-[11px] font-medium text-pending sm:text-xs lg:text-sm">{meeting.timeline}</div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted sm:text-xs lg:text-sm">เอกสารรอตรวจอยู่ที่</span>
          {workload.map((entry) => (
            <span
              key={entry.name}
              className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent sm:px-2.5 sm:text-[11.5px] lg:px-3 lg:py-1 lg:text-sm"
            >
              {entry.name} {entry.count}
            </span>
          ))}
        </div>
      </div>

      {creating && (
        <CreateTaskForm
          owners={owners}
          onCreate={(input) => {
            onCreateTask(meeting.id, input);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="mt-3.5">
        <TaskTable
          tasks={meeting.tasks.slice().sort((a, b) => a.sortOrder - b.sortOrder)}
          owners={owners}
          inspectors={inspectors}
          people={people}
          canManageTasks={canManageTasks}
          currentUserId={currentUserId}
          onDeleteTask={onDeleteTask}
          onEditTask={onEditTask}
          onSendForReview={onSendForReview}
          onMarkReviewed={onMarkReviewed}
          onCloseTask={onCloseTask}
          onReopenTask={onReopenTask}
          onAddHistoryNote={onAddHistoryNote}
        />
      </div>
    </div>
  );
}
