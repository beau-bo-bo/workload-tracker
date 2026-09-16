"use client";

import { useMemo, useState } from "react";
import { BackIcon } from "@/components/icons";
import { BoardPostCard } from "./BoardPostCard";
import { CreateBoardPostForm } from "./CreateBoardPostForm";
import type { BoardPost, BoardPostInput, Person } from "./board-types";

type FilterTab = "all" | "tagged" | "mine";

/**
 * ตัวเลขท้ายแท็บ Tagged/Mine เป็น "จำนวนทั้งหมด" ไม่ใช่ตัวแจ้งเตือน
 * จึงอยู่ถาวรและลดลงก็ต่อเมื่อ memo ถูกลบเท่านั้น (ต่างจาก Red Badge ที่หน้าหลักซึ่งเป็นของใหม่ที่ยังไม่ได้อ่าน)
 * แท็บ All ไม่ใส่ตัวเลข เพราะจำนวนการ์ดที่เห็นตรงหน้าก็คือคำตอบอยู่แล้ว
 */
const FILTER_TABS: { key: FilterTab; label: string; showCount: boolean }[] = [
  { key: "all", label: "All", showCount: false },
  { key: "tagged", label: "Tagged", showCount: true },
  { key: "mine", label: "Mine", showCount: true },
];

export function BoardView({
  posts,
  newPostIds,
  allUsers,
  currentUserId,
  canManageTasks,
  onBack,
  onCreatePost,
  onEditPost,
  onDeletePost,
  onAddComment,
  onDeleteComment,
}: {
  posts: BoardPost[];
  /** id ของ memo ที่ยังไม่ได้อ่าน ณ วินาทีที่กดเข้าหน้านี้ — ใช้ติดป้าย New ให้เห็นว่าอันไหนคือของใหม่ */
  newPostIds: ReadonlySet<string>;
  allUsers: Person[];
  currentUserId: string;
  canManageTasks: boolean;
  onBack: () => void;
  onCreatePost: (input: BoardPostInput) => void;
  onEditPost: (postId: string, input: BoardPostInput) => void;
  onDeletePost: (postId: string) => void;
  onAddComment: (postId: string, body: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [creating, setCreating] = useState(false);
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);

  const taggedPosts = useMemo(
    () => posts.filter((p) => p.taggedUserIds.includes(currentUserId)),
    [posts, currentUserId]
  );
  const myPosts = useMemo(() => posts.filter((p) => p.authorId === currentUserId), [posts, currentUserId]);
  const counts: Record<FilterTab, number> = { all: posts.length, tagged: taggedPosts.length, mine: myPosts.length };

  const filteredPosts = tab === "all" ? posts : tab === "tagged" ? taggedPosts : myPosts;

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

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-text">The Wall</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary"
        >
          + New Memo
        </button>
      </div>

      <div className="mt-3.5 flex w-fit gap-0.5 rounded-full bg-closed-soft p-[3px]">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              tab === t.key ? "bg-surface text-text shadow-sm" : "text-muted"
            }`}
          >
            {t.label}
            {t.showCount && counts[t.key] > 0 && (
              <span
                className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none ${
                  tab === t.key ? "bg-accent-soft text-accent" : "bg-surface/70 text-muted"
                }`}
              >
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {creating && (
        <CreateBoardPostForm
          allUsers={allUsers}
          onCreate={(input) => {
            onCreatePost(input);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editingPost && (
        <CreateBoardPostForm
          allUsers={allUsers}
          editingPost={editingPost}
          onCreate={(input) => {
            onEditPost(editingPost.id, input);
            setEditingPost(null);
          }}
          onCancel={() => setEditingPost(null)}
        />
      )}

      <div className="mt-4.5 flex flex-col gap-2.5 sm:block sm:columns-2 sm:gap-5 lg:columns-3">
        {filteredPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            No memos yet
          </div>
        ) : (
          filteredPosts.map((post, index) => (
            <BoardPostCard
              key={post.id}
              post={post}
              index={index}
              isNew={newPostIds.has(post.id)}
              currentUserId={currentUserId}
              canManageTasks={canManageTasks}
              onEdit={setEditingPost}
              onDelete={onDeletePost}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
            />
          ))
        )}
      </div>
    </div>
  );
}
