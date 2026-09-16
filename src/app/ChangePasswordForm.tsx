"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./change-password-actions";

const initialState: ChangePasswordState = null;

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <div className="w-full text-left">
      <form action={formAction} className="flex flex-col gap-2">
        <input
          name="currentPassword"
          type="password"
          placeholder="รหัสผ่านปัจจุบัน"
          required
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <input
          name="newPassword"
          type="password"
          placeholder="รหัสผ่านใหม่"
          required
          minLength={6}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="ยืนยันรหัสผ่านใหม่"
          required
          minLength={6}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-50"
        />

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-green-600 dark:text-green-400">{state.success}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
