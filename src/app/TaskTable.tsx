"use client";

import { TASK_ROW_GRID, TaskRow } from "./TaskRow";
import type { ChecklistItem, Person, Task, TaskInput } from "./board-types";
import type { SkippedReviewChoice } from "./task-workflow";
import type { PeopleIndex } from "./board-derived";

export function TaskTable({
  tasks,
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
  tasks: Task[];
  owners: Person[];
  inspectors: Person[];
  people: PeopleIndex;
  canManageTasks: boolean;
  currentUserId: string;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, input: TaskInput, checklist: ChecklistItem[], excludedAutoSteps: string[]) => void;
  onSendForReview: (taskId: string, inspector: string, message?: string, choice?: SkippedReviewChoice) => void;
  onMarkReviewed: (taskId: string, message?: string) => void;
  onCloseTask: (taskId: string, choice?: SkippedReviewChoice) => void;
  onReopenTask: (taskId: string) => void;
  onAddHistoryNote: (taskId: string, entryId: string, text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 lg:gap-3">
      <div
        className={`${TASK_ROW_GRID} px-3 text-[11px] leading-tight font-bold tracking-wide text-text sm:text-[11.5px] sm:leading-normal lg:text-[13px]`}
      >
        <div>วาระ/เรื่อง</div>
        <div className="text-center">ผู้รับผิดชอบ</div>
        <div className="text-center">สถานะ</div>
        <div className="text-center">ด่วน</div>
        <div />
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted lg:py-8 lg:text-base">
          ยังไม่มีวาระ/เรื่อง
        </div>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
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
        ))
      )}
    </div>
  );
}
