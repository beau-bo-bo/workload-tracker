"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { USER_ROW_GRID, UserRow, type UserListItem } from "./UserRow";
import { setUserOrderAction } from "./actions";

export function UserList({ initialUsers }: { initialUsers: UserListItem[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [prevInitialUsers, setPrevInitialUsers] = useState(initialUsers);
  const [, startTransition] = useTransition();

  if (initialUsers !== prevInitialUsers) {
    setPrevInitialUsers(initialUsers);
    setUsers(initialUsers);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = users.findIndex((u) => u.id === active.id);
    const newIndex = users.findIndex((u) => u.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(users, oldIndex, newIndex);
    setUsers(next);
    startTransition(() => {
      setUserOrderAction(next.map((u) => u.id));
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-2">
      <div className={`${USER_ROW_GRID} px-3 text-[11px] font-bold text-text sm:text-xs`}>
        <span />
        <span>ชื่อที่แสดง</span>
        <span>Role</span>
        <span className="text-right">จัดการ</span>
      </div>

      <DndContext id="user-list" sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={users.map((u) => u.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
