"use client";

import { useActionState, useEffect, useState } from "react";
import { createUserAction, type ActionState } from "./actions";

const initialState: ActionState = null;

export function CreateUserForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  useEffect(() => {
    if (state?.success) {
      setIsOpen(false);
    }
  }, [state]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary"
      >
        + เพิ่มผู้ใช้งาน
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-bg p-4 sm:grid-cols-2"
    >
      <div className="col-span-full flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">สร้างผู้ใช้งานใหม่</h2>
        <button type="button" onClick={() => setIsOpen(false)} className="text-xs font-medium text-muted hover:underline">
          ยกเลิก
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[11.5px] font-medium text-muted">ชื่อที่แสดง</label>
        <input
          name="displayName"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      <div>
        <span className="mb-1 block text-[11.5px] font-medium text-muted">
          Role (เลือกได้มากกว่า 1)
        </span>
        <div className="flex flex-wrap gap-3 pt-1">
          <label className="flex items-center gap-1.5 text-sm text-text">
            <input type="checkbox" name="roles" value="owner" defaultChecked />
            Owner
          </label>
          <label className="flex items-center gap-1.5 text-sm text-text">
            <input type="checkbox" name="roles" value="inspector" />
            Inspector
          </label>
          <label className="flex items-center gap-1.5 text-sm text-text">
            <input type="checkbox" name="roles" value="admin" />
            Admin
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11.5px] font-medium text-muted">Username</label>
        <input
          name="username"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11.5px] font-medium text-muted">Password</label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      {state?.error && <p className="col-span-full text-sm text-pending">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="col-span-full rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
      >
        {pending ? "กำลังสร้าง..." : "สร้างผู้ใช้งาน"}
      </button>
    </form>
  );
}
