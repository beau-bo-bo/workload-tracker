"use client";

import { useActionState, useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditIcon, GripIcon, KeyIcon } from "@/components/icons";
import { DeleteUserButton } from "./DeleteUserButton";
import { updateUserAction, resetPasswordAction, type ActionState } from "./actions";
import type { Role } from "@/lib/supabase";
import { REVIEW_GROUPS } from "@/app/board-types";

export const USER_ROW_GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_6rem] items-center gap-2 sm:grid-cols-[1.75rem_minmax(0,16rem)_8rem_13.5rem] sm:gap-3 lg:grid-cols-[1.75rem_minmax(0,16rem)_8rem_1fr]";

const initialState: ActionState = null;

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  inspector: "Inspector",
  admin: "Admin",
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "inspector", label: "Inspector" },
  { value: "admin", label: "Admin" },
];

export type UserListItem = {
  id: string;
  displayName: string;
  username: string;
  roles: Role[];
  reviewGroups: string[];
  canManageTasks: boolean;
};

export function UserRow({ user }: { user: UserListItem }) {
  const { id, displayName, username, roles, reviewGroups, canManageTasks } = user;
  const [panel, setPanel] = useState<"none" | "edit" | "reset">("none");
  const [editState, editAction, editPending] = useActionState(updateUserAction, initialState);
  const [resetState, resetAction, resetPending] = useActionState(resetPasswordAction, initialState);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  useEffect(() => {
    if (editState?.success) setPanel("none");
  }, [editState]);

  useEffect(() => {
    if (resetState?.success) setPanel("none");
  }, [resetState]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border bg-surface ${isDragging ? "z-10 opacity-60 shadow-lg" : ""}`}
    >
      <div className={`${USER_ROW_GRID} px-3 py-2.5`}>
        <button
          type="button"
          title="ลากเพื่อจัดลำดับ"
          className="flex h-6 w-6 touch-none items-center justify-center text-muted hover:text-text active:cursor-grabbing"
          style={{ cursor: "grab" }}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>

        <div className="min-w-0">
          <p className="truncate text-sm text-text">{displayName}</p>
          <p className="truncate text-[11px] text-muted">{username}</p>
        </div>

        <p className="text-xs text-muted">{roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</p>

        <div className="flex items-center justify-end gap-1 lg:justify-between">
          <button
            type="button"
            title="Reset Password"
            onClick={() => setPanel((p) => (p === "reset" ? "none" : "reset"))}
            className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text sm:rounded-lg sm:border sm:border-border sm:px-2.5 sm:py-1.5 sm:text-text sm:hover:border-accent sm:hover:bg-transparent sm:hover:text-accent"
          >
            <KeyIcon />
            <span className="hidden text-xs font-medium whitespace-nowrap sm:inline">Reset Password</span>
          </button>
          <button
            type="button"
            title="แก้ไขผู้ใช้งาน"
            onClick={() => setPanel((p) => (p === "edit" ? "none" : "edit"))}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-closed-soft hover:text-text"
          >
            <EditIcon />
          </button>
          <DeleteUserButton userId={id} displayName={displayName} />
        </div>
      </div>

      {panel === "edit" && (
        <form
          action={editAction}
          className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-3"
        >
          <input type="hidden" name="userId" value={id} />
          <input
            name="displayName"
            defaultValue={displayName}
            required
            className="w-36 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {ROLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1 text-xs text-text">
                <input type="checkbox" name="roles" value={opt.value} defaultChecked={roles.includes(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] text-muted">กลุ่มตรวจ (เฉพาะ Inspector, เว้นว่าง = ทุกกลุ่ม):</span>
            {REVIEW_GROUPS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-1 text-xs text-text">
                <input
                  type="checkbox"
                  name="reviewGroups"
                  value={opt.key}
                  defaultChecked={reviewGroups.includes(opt.key)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex items-center gap-1.5 text-xs text-text">
              <input type="checkbox" name="canManageTasks" defaultChecked={canManageTasks} />
              สร้าง/แก้ไข/ลบวาระได้
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={editPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
            >
              {editPending ? "..." : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="text-xs font-medium text-muted hover:underline"
            >
              ยกเลิก
            </button>
          </div>
          {editState?.error && <span className="w-full text-xs text-pending">{editState.error}</span>}
        </form>
      )}

      {panel === "reset" && (
        <form
          action={resetAction}
          className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-3"
        >
          <input type="hidden" name="userId" value={id} />
          <input
            name="newPassword"
            type="password"
            placeholder="รหัสผ่านใหม่"
            required
            minLength={6}
            autoFocus
            className="w-36 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={resetPending}
            className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-text hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {resetPending ? "..." : "Reset"}
          </button>
          <button
            type="button"
            onClick={() => setPanel("none")}
            className="text-xs font-medium text-muted hover:underline"
          >
            ยกเลิก
          </button>
          {resetState?.error && <span className="w-full text-xs text-pending">{resetState.error}</span>}
        </form>
      )}
    </div>
  );
}
