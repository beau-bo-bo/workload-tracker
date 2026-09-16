"use client";

import { useId, useState, type FormEvent } from "react";
import { CommentIcon, EditIcon, TrashIcon } from "@/components/icons";
import { RelativeTime } from "@/components/RelativeTime";
import { boardPostRelevantToMe, formatShortDate, reminderUrgency } from "./board-derived";
import type { BoardPost } from "./board-types";

const REMINDER_PILL_CLASS: Record<"soon" | "later", string> = {
  soon: "bg-pending-soft text-pending",
  later: "bg-closed-soft text-muted",
};

/** สีกระดาษโน้ตแบบ Post-it — วนใช้ Token pastel ที่มีอยู่แล้ว ไม่เพิ่มสีใหม่ (ทุกขนาดจอที่ไม่ใช่มือถือ ตั้งแต่ `sm:` ขึ้นไป) */
const NOTE_BG_CLASSES = ["sm:bg-primary-soft", "sm:bg-pending-soft", "sm:bg-done-soft", "sm:bg-accent-soft", "sm:bg-closed-soft"];
/** มุมเอียงคงที่ต่อใบ (deterministic ตาม index กันปัญหา hydration mismatch จาก Math.random) */
const NOTE_ROTATIONS = ["-1.5deg", "1deg", "-0.75deg", "1.5deg", "-1deg", "0.75deg"];

export function BoardPostCard({
  post,
  index,
  isNew,
  currentUserId,
  canManageTasks,
  onEdit,
  onDelete,
  onAddComment,
  onDeleteComment,
}: {
  post: BoardPost;
  index: number;
  /** โพสต์ที่ยังไม่ได้อ่าน ณ ตอนที่เพิ่งกดเข้าหน้านี้ — ค้างไว้ทั้งรอบที่เปิดอยู่ ไม่หายไปทันทีที่ badge เป็นศูนย์ */
  isNew: boolean;
  currentUserId: string;
  canManageTasks: boolean;
  onEdit: (post: BoardPost) => void;
  onDelete: (postId: string) => void;
  onAddComment: (postId: string, body: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const threadId = useId();
  const [commentText, setCommentText] = useState("");
  const urgency = reminderUrgency(post.reminderDate);
  const shortDate = formatShortDate(post.reminderDate);
  const noteBg = NOTE_BG_CLASSES[index % NOTE_BG_CLASSES.length];
  const noteRotate = NOTE_ROTATIONS[index % NOTE_ROTATIONS.length];
  const isRelevantToMe = boardPostRelevantToMe(post, currentUserId);

  function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(post.id, commentText.trim());
    setCommentText("");
    setReplying(false);
  }

  return (
    <div
      style={{ "--note-rotate": noteRotate } as React.CSSProperties}
      onClick={() => setExpanded((v) => !v)}
      className={`cursor-pointer rounded-xl border bg-surface px-4 py-3.5 hover:shadow-md sm:mb-5 sm:break-inside-avoid sm:rotate-[var(--note-rotate)] sm:border-0 sm:shadow-md sm:transition-transform sm:hover:rotate-0 sm:hover:shadow-lg ${
        isNew
          ? "border-accent sm:ring-2 sm:ring-accent"
          : isRelevantToMe
            ? "border-pending sm:ring-2 sm:ring-pending"
            : "border-border"
      } ${noteBg}`}
    >
      {(isNew || isRelevantToMe || post.taggedNames.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {isNew && (
            <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-bg uppercase">
              New
            </span>
          )}
          {isRelevantToMe && (
            <span className="rounded-md bg-pending-soft px-2 py-0.5 text-[11px] font-semibold text-pending sm:bg-surface/70">
              For you
            </span>
          )}
          {post.taggedNames.map((name) => (
            <span
              key={name}
              className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent sm:bg-surface/70 sm:text-text"
            >
              @{name}
            </span>
          ))}
        </div>
      )}

      {/*
        a11y (แก้ U8): ตัวการ์ดเป็น div + onClick ซึ่งกด Tab ไม่ถึงและกด Enter ไม่ได้
        จึงทำ "ตัวข้อความ memo" ให้เป็นปุ่มจริงสำหรับกางดู Reply (ครอบทั้งใบเป็นปุ่มไม่ได้ เพราะมีปุ่มแก้ไข/ลบอยู่ข้างใน)
        คนใช้เมาส์ยังกดที่ใบไหนตรงไหนก็ได้เหมือนเดิม
      */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={threadId}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="w-full cursor-pointer text-left whitespace-pre-wrap text-sm leading-relaxed text-text"
      >
        {post.body}
      </button>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="rounded-md bg-closed-soft px-2 py-0.5 font-medium text-text sm:bg-surface/70">{post.authorName}</span>
          <RelativeTime iso={post.createdAt} />
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="จำนวน Reply — กดที่กล่องเพื่อดู">
            <CommentIcon className="h-3.5 w-3.5" />
            {post.comments.length}
          </span>
          {shortDate && (
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${REMINDER_PILL_CLASS[urgency ?? "later"]}`}>
              {urgency === "soon" && "🔥 "}
              {shortDate}
            </span>
          )}
          {post.authorId === currentUserId && (
            <button
              type="button"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(post);
              }}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted hover:bg-closed-soft hover:text-text"
            >
              <EditIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {(post.authorId === currentUserId || canManageTasks) && (
            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this memo? It will move to Trash.")) onDelete(post.id);
              }}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted hover:bg-pending-soft hover:text-pending"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>

      {expanded && (
        <div id={threadId} className="mt-3 flex flex-col gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
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
            <form onSubmit={handleAddComment} className="flex items-center gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Reply..."
                autoFocus
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
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
