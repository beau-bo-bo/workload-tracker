"use client";

import { BackIcon, RestoreIcon, TrashIcon } from "@/components/icons";
import { meetingStatusLabel } from "./board-derived";
import type { BoardPost, Meeting, Task } from "./board-types";

export function TrashView({
  archivedMeetings,
  deletedTasks,
  deletedBoardPosts,
  canManageTasks,
  onBack,
  onRestoreMeeting,
  onDeleteMeetingForever,
  onRestoreTask,
  onDeleteTaskForever,
  onRestoreBoardPost,
  onDeleteBoardPostForever,
}: {
  archivedMeetings: Meeting[];
  deletedTasks: Task[];
  deletedBoardPosts: BoardPost[];
  canManageTasks: boolean;
  onBack: () => void;
  onRestoreMeeting: (meetingId: string) => void;
  onDeleteMeetingForever: (meetingId: string) => void;
  onRestoreTask: (taskId: string) => void;
  onDeleteTaskForever: (taskId: string) => void;
  onRestoreBoardPost: (postId: string) => void;
  onDeleteBoardPostForever: (postId: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text hover:border-accent hover:text-accent"
      >
        <BackIcon />
        กลับหน้าหลัก
      </button>

      <h2 className="mt-3.5 font-display text-xl font-semibold text-text">ถังขยะ</h2>
      <p className="mt-1 max-w-prose text-xs text-muted">
        กดซ่อนครั้งที่ประชุม หรือกดลบวาระ/เรื่อง จะมาอยู่ที่นี่ก่อนเสมอ — ค่อยเลือกกู้คืนหรือลบถาวรจากตรงนี้
      </p>

      <section className="mt-6">
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
          ครั้งที่ประชุมที่เก็บไว้
        </h3>
        {archivedMeetings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-3.5 text-xs text-muted">
            ไม่มีครั้งที่ประชุมในถังขยะ
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {archivedMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 opacity-85"
              >
                <h4 className="font-display text-[15px] font-medium text-muted">{meeting.title}</h4>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-closed-soft px-3 py-1 text-xs font-medium text-muted">
                    {meetingStatusLabel(meeting)}
                  </span>
                  {canManageTasks && (
                    <>
                      <button
                        type="button"
                        title="กู้คืน"
                        onClick={() => onRestoreMeeting(meeting.id)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text"
                      >
                        <RestoreIcon />
                      </button>
                      <button
                        type="button"
                        title="ลบถาวร"
                        onClick={() => onDeleteMeetingForever(meeting.id)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-pending-soft hover:text-pending"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
          วาระ/เรื่องที่ลบ
        </h3>
        {deletedTasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-3.5 text-xs text-muted">
            ไม่มีวาระ/เรื่องในถังขยะ
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {deletedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{task.title}</p>
                  <p className="text-[11.5px] text-muted">จาก {task.deletedFromMeetingTitle ?? "อื่น ๆ"}</p>
                </div>
                {canManageTasks && (
                  <div className="flex flex-none items-center gap-1">
                    <button
                      type="button"
                      title="กู้คืน"
                      onClick={() => onRestoreTask(task.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text"
                    >
                      <RestoreIcon />
                    </button>
                    <button
                      type="button"
                      title="ลบถาวร"
                      onClick={() => onDeleteTaskForever(task.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-pending-soft hover:text-pending"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
          กระทู้บอร์ดที่ลบ
        </h3>
        {deletedBoardPosts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-3.5 text-xs text-muted">
            ไม่มีกระทู้บอร์ดในถังขยะ
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {deletedBoardPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{post.body}</p>
                  <p className="text-[11.5px] text-muted">โดย {post.authorName}</p>
                </div>
                {canManageTasks && (
                  <div className="flex flex-none items-center gap-1">
                    <button
                      type="button"
                      title="กู้คืน"
                      onClick={() => onRestoreBoardPost(post.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text"
                    >
                      <RestoreIcon />
                    </button>
                    <button
                      type="button"
                      title="ลบถาวร"
                      onClick={() => onDeleteBoardPostForever(post.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-pending-soft hover:text-pending"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
