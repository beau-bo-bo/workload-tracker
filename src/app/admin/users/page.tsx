import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getSupabaseClient, type UserRow } from "@/lib/supabase";
import { BackIcon } from "@/components/icons";
import { CreateUserForm } from "./CreateUserForm";
import { UserList } from "./UserList";

export default async function AdminUsersPage() {
  const admin = await getSession();
  const supabase = getSupabaseClient();
  const { data: users } = await supabase.rpc("admin_list_users", {
    p_admin_id: admin?.id,
  });

  const userList = (users ?? []).map((u: UserRow) => ({
    id: u.id,
    displayName: u.display_name,
    username: u.username,
    roles: u.roles,
    reviewGroups: u.review_groups,
    canManageTasks: u.can_manage_tasks,
  }));

  return (
    <div className="flex flex-1 flex-col bg-bg text-text">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text hover:border-accent hover:text-accent"
        >
          <BackIcon />
          กลับหน้าหลัก
        </Link>

        <h1 className="mt-3.5 mb-6 font-display text-xl font-semibold text-text">จัดการผู้ใช้งาน</h1>

        <CreateUserForm />

        <UserList initialUsers={userList} />
      </div>
    </div>
  );
}
