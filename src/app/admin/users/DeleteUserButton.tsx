"use client";

import { useActionState } from "react";
import { deleteUserAction, type ActionState } from "./actions";
import { TrashIcon } from "@/components/icons";

const initialState: ActionState = null;

export function DeleteUserButton({ userId, displayName }: { userId: string; displayName: string }) {
  const [state, formAction, pending] = useActionState(deleteUserAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`ลบผู้ใช้งาน "${displayName}" ถาวรใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        title="ลบผู้ใช้งาน"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-pending hover:bg-pending-soft disabled:opacity-50"
      >
        <TrashIcon />
      </button>
      {state?.error && <p className="mt-1 text-xs text-pending">{state.error}</p>}
    </form>
  );
}
