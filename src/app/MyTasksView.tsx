"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { BackIcon, ChecklistIcon, CommentIcon, EditIcon, TrashIcon } from "@/components/icons";
import { RelativeTime } from "@/components/RelativeTime";
import { formatShortDate, reminderUrgency } from "./board-derived";
import { CreateBoardPostForm } from "./CreateBoardPostForm";
import { TASK_ROW_GRID, TaskRow } from "./TaskRow";
import type { BoardPost, BoardPostInput, ChecklistItem, Person, Task, TaskInput } from "./board-types";
import type { SkippedReviewChoice } from "./task-workflow";
import type { PeopleIndex } from "./board-derived";

const URGENCY_PILL: Record<"soon" | "later", string> = {
  soon: "bg-pending-soft text-pending",
  later: "bg-closed-soft text-muted",
};

function SectionHeading({ icon, label, count }: { icon: ReactNode; label: string; count: number }) {
  return (
    <div className="mt-6 flex items-center gap-2">
      {icon}
      <h3 className="font-display text-lg font-semibold text-text lg:text-xl">{label}</h3>
      {count > 0 && (
        <span className="rounded-full bg-closed-soft px-2 py-0.5 text-[11px] font-semibold text-muted">{count}</span>
      )}
    </div>
  );
}

function BoardPostMiniRow({
  post,
  currentUserId,
  canManageTasks,
  onAddComment,
  onDeleteComment,
  onEdit,
}: {
  post: BoardPost;
  currentUserId: string;
  canManageTasks: boolean;
  onAddComment: (postId: string, body: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onEdit: (post: BoardPost) => void;
}) {
  const [showThread, setShowThread] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const threadId = useId();
  const urgency = reminderUrgency(post.reminderDate);
  const shortDate = formatShortDate(post.reminderDate);
  const source = post.authorId === currentUserId ? "Posted by me" : `Tagged by ${post.authorName}`;

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAddComment(post.id, text.trim());
    setText("");
    setReplying(false);
  }

  return (
    <div
      onClick={() => setShowThread((v) => !v)}
      className={`cursor-pointer rounded-xl border bg-bg px-3.5 py-3 hover:bg-closed-soft/30 ${urgency === "soon" ? "border-pending" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* a11y (แก้ U8): ข้อความ memo เป็นปุ่มจริงสำหรับกางดู Reply — เดิมทั้งแถวเป็น div + onClick ที่คีย์บอร์ดเข้าไม่ถึง */}
        <button
          type="button"
          aria-expanded={showThread}
          aria-controls={threadId}
          onClick={(e) => {
            e.stopPropagation();
            setShowThread((v) => !v);
          }}
          className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left text-sm font-bold text-text"
        >
          {post.body}
        </button>
        {shortDate && (
          <span
            className={`flex-none rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${URGENCY_PILL[urgency ?? "later"]}`}
          >
            {urgency === "soon" && "🔥 "}
            {shortDate}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{source}</span>
        <span className="flex items-center gap-2">
          {post.authorId === currentUserId && (
            <button
              type="button"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(post);
              }}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-text"
            >
              <EditIcon className="h-3 w-3" />
            </button>
          )}
          <span className="flex items-center gap-1" title="จำนวน Reply — กดที่แถวเพื่อดู">
            <CommentIcon className="h-3 w-3" />
            {post.comments.length}
          </span>
        </span>
      </div>

      {showThread && (
        <div id={threadId} className="mt-2.5 flex flex-col gap-2 border-t border-border pt-2.5" onClick={(e) => e.stopPropagation()}>
          {post.comments.length === 0 ? (
            <span className="text-[11px] text-muted">No comments yet</span>
          ) : (
            post.comments.map((comment) => (
              <div key={comment.id} className="group flex items-start justify-between gap-2 rounded-lg bg-closed-soft/40 px-3 py-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="font-semibold text-text">{comment.authorName}</span>
                    <RelativeTime iso={comment.at} />
                  </span>
                  <span className="text-sm text-text">{comment.body}</span>
                </div>
                {(comment.authorId === currentUserId || canManageTasks) && (
                  <button
                    type="button"
                    title="Delete comment"
                    onClick={() => {
                      if (confirm("Delete this comment?")) onDeleteComment(post.id, comment.id);
                    }}
                    className="flex-none rounded-md p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-pending-soft hover:text-pending"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))
          )}

          {replying ? (
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Reply..."
                autoFocus
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
              />
              <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary">
                Send
              </button>
            </form>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReplying(true)}
                className="rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent hover:opacity-80"
              >
                + Reply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MyTasksView({
  entries,
  boardPosts,
  allUsers,
  people,
  currentUserId,
  owners,
  canManageTasks,
  onBack,
  onDeleteTask,
  onEditTask,
  onSendForReview,
  onMarkReviewed,
  onCloseTask,
  onReopenTask,
  onAddHistoryNote,
  onAddBoardComment,
  onEditBoardPost,
  onDeleteBoardComment,
}: {
  entries: { task: Task; context: string; inspectors: Person[] }[];
  boardPosts: BoardPost[];
  allUsers: Person[];
  people: PeopleIndex;
  currentUserId: string;
  owners: Person[];
  canManageTasks: boolean;
  onBack: () => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, input: TaskInput, checklist: ChecklistItem[], excludedAutoSteps: string[]) => void;
  onSendForReview: (taskId: string, inspector: string, message?: string, choice?: SkippedReviewChoice) => void;
  onMarkReviewed: (taskId: string, message?: string) => void;
  onCloseTask: (taskId: string, choice?: SkippedReviewChoice) => void;
  onReopenTask: (taskId: string) => void;
  onAddHistoryNote: (taskId: string, entryId: string, text: string) => void;
  onAddBoardComment: (postId: string, body: string) => void;
  onEditBoardPost: (postId: string, input: BoardPostInput) => void;
  onDeleteBoardComment: (postId: string, commentId: string) => void;
}) {
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:max-w-6xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text hover:border-accent hover:text-accent"
      >
        <BackIcon />
        กลับหน้าหลัก
      </button>

      <h2 className="mt-3.5 font-display text-xl font-semibold text-text lg:text-2xl">งานของฉัน</h2>

      <SectionHeading icon={<ChecklistIcon className="h-4 w-4 text-accent" />} label="My work" count={entries.length} />

      {entries.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          ไม่มีงานที่ต้องดำเนินการตอนนี้
        </div>
      ) : (
        <section className="mt-3 rounded-2xl border border-border bg-surface p-3 sm:p-5 lg:p-6">
          <div
            className={`${TASK_ROW_GRID} px-3 pb-2.5 text-[11px] leading-tight font-bold tracking-wide text-text sm:text-[11.5px] sm:leading-normal lg:text-[13px]`}
          >
            <div>วาระ/เรื่อง</div>
            <div className="text-center">ผู้รับผิดชอบ</div>
            <div className="text-center">สถานะ</div>
            <div className="text-center">ด่วน</div>
            <div />
          </div>

          <div className="flex flex-col gap-4">
            {entries.map(({ task, context, inspectors }) => (
              <div key={task.id} className="flex flex-col gap-1.5">
                <span className="px-1 font-display text-sm font-semibold text-text lg:text-base">{context}</span>
                <TaskRow
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
              </div>
            ))}
          </div>
        </section>
      )}

      <SectionHeading icon={<CommentIcon className="h-4 w-4 text-accent" />} label="My Memo" count={boardPosts.length} />

      {boardPosts.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          No memos related to you right now
        </div>
      ) : (
        <section className="mt-3 rounded-2xl border border-border bg-surface p-3 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-2.5">
            {boardPosts
              .slice()
              .sort((a, b) => {
                if (a.reminderDate && b.reminderDate) return a.reminderDate.localeCompare(b.reminderDate);
                if (a.reminderDate) return -1;
                if (b.reminderDate) return 1;
                return b.createdAt.localeCompare(a.createdAt);
              })
              .map((post) => (
                <BoardPostMiniRow
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  canManageTasks={canManageTasks}
                  onAddComment={onAddBoardComment}
                  onDeleteComment={onDeleteBoardComment}
                  onEdit={setEditingPost}
                />
              ))}
          </div>
        </section>
      )}

      {editingPost && (
        <CreateBoardPostForm
          allUsers={allUsers}
          editingPost={editingPost}
          onCreate={(input) => {
            onEditBoardPost(editingPost.id, input);
            setEditingPost(null);
          }}
          onCancel={() => setEditingPost(null)}
        />
      )}
    </div>
  );
}
