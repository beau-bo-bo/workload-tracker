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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BackIcon, GripIcon } from "@/components/icons";
import { setDashboardOrderAction } from "./board-actions";
import {
  EMPTY_MARK,
  EMPTY_MARK_CLASS,
  workloadMatrix,
  type WorkloadMatrixColumn,
  type WorkloadMatrixRow,
} from "./board-derived";
import type { Meeting, Person, Task } from "./board-types";

const GRIP_COL = "1.25rem";
const NAME_COL = "minmax(2.25rem, 4rem)";
const TOTAL_COL = "minmax(2.5rem, 1fr)";
const matrixGridStyle = (columns: number) => ({
  gridTemplateColumns: `${GRIP_COL} ${NAME_COL} repeat(${columns}, minmax(0, 1fr)) ${TOTAL_COL}`,
});

/** ระดับความเข้มของ Heat Map พร้อมคำอธิบาย — ตัวอย่างช่องใช้ heatCellClass ตัวเดียวกับตารางจริง จะได้ไม่มีวันหลุด sync กัน */
const HEAT_LEGEND = [
  { sample: 0, label: "ไม่มีงานค้าง" },
  { sample: 1, label: "1-2 งาน" },
  { sample: 3, label: "3-4 งาน" },
  { sample: 5, label: "5 งานขึ้นไป" },
];

/** ไล่ความเข้ม 3 ระดับตามที่ผู้ใช้กำหนด 2026-09-16 (เดิมมีแค่ 1 กับ 2+ ซึ่งงานเยอะแค่ไหนก็เข้มเท่ากันหมด) */
function heatCellClass(count: number): string {
  if (count === 0) return "border border-border bg-bg";
  if (count <= 2) return "border border-transparent bg-pending-soft text-pending font-bold";
  if (count <= 4) return "border border-transparent bg-pending-mid text-pending font-bold";
  return "border border-transparent bg-pending text-bg font-extrabold";
}

function DragHandle({
  isAdmin,
  attributes,
  listeners,
}: {
  isAdmin: boolean;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  if (!isAdmin) return <span />;
  return (
    <button
      type="button"
      className="flex cursor-grab items-center justify-center text-muted/60 hover:text-text active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function MatrixRow({
  id,
  row,
  columns,
  isAdmin,
}: {
  id: string;
  row: WorkloadMatrixRow;
  columns: WorkloadMatrixColumn[];
  isAdmin: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isAdmin,
  });
  const style = {
    ...matrixGridStyle(columns.length),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid items-center gap-0.5 sm:gap-1.5">
      <DragHandle isAdmin={isAdmin} attributes={attributes} listeners={listeners} />
      <span className="truncate text-[11.5px] font-semibold text-text sm:text-[12.5px]">{row.name}</span>
      {row.counts.map((count, i) => (
        <div
          key={columns[i].key}
          className={`flex h-6 items-center justify-center rounded-md text-[11px] sm:h-9 sm:rounded-lg sm:text-[13px] ${heatCellClass(count)}`}
        >
          {count > 0 ? count : <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>}
        </div>
      ))}
      <div className="flex h-6 items-center justify-center rounded-md text-[11px] font-extrabold sm:h-9 sm:rounded-lg sm:text-[13px]">
        {row.total > 0 ? (
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-on-primary sm:px-2.5 sm:py-1">{row.total}</span>
        ) : (
          <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>
        )}
      </div>
    </div>
  );
}

export function WorkloadDashboard({
  people,
  meetings,
  otherTasks,
  isAdmin,
  onBack,
}: {
  people: Person[];
  meetings: Meeting[];
  otherTasks: Task[];
  isAdmin: boolean;
  onBack: () => void;
}) {
  const [orderedPeople, setOrderedPeople] = useState(people);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedPeople.findIndex((p) => p.id === active.id);
    const newIndex = orderedPeople.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedPeople, oldIndex, newIndex);
    setOrderedPeople(next);
    startTransition(() => {
      setDashboardOrderAction(next.map((p) => p.id));
    });
  }

  const matrix = workloadMatrix(meetings, otherTasks, orderedPeople);
  const matrixRowById = new Map(matrix.rows.map((r) => [r.id, r]));
  const itemIds = orderedPeople.map((p) => p.id);

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

      <h2 className="mt-3.5 font-display text-xl font-semibold text-text">Dashboard</h2>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-3 sm:p-5">
        <h3 className="mb-1 font-display text-[15px] font-semibold text-text">Heat Map</h3>
        <p className="mb-2 text-[11px] text-muted">
          หมายเหตุ : จำนวนงานที่ได้รับ Assign + งานที่ต้องตรวจ (เฉพาะผู้ตรวจ) ณ ปัจจุบัน ไม่รวมที่ปิดงานแล้ว
        </p>

        {/*
          คำอธิบายสี (แก้ U12) — เดิมความเข้มของสีเป็นสัญญาณเดียวที่บอกว่างานเยอะแค่ไหน
          คนตาบอดสีแดง-เขียว (ราว 8% ของผู้ชาย) แยกระดับไม่ออก และไม่มีอะไรบอกว่าสีเข้ม = อะไร
        */}
        <ul className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
          {HEAT_LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`flex h-5 w-6 items-center justify-center rounded-md text-[11px] ${heatCellClass(item.sample)}`}
              >
                {item.sample > 0 ? item.sample : <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>}
              </span>
              {item.label}
            </li>
          ))}
        </ul>

        {orderedPeople.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-bg px-4 py-3.5 text-center text-xs text-muted">
            ยังไม่มีข้อมูล Owner/Inspector ในระบบ
          </p>
        ) : (
          <div className="w-full">
            <div
              className="grid items-end gap-0.5 pb-1.5 sm:gap-1.5 sm:pb-2"
              style={matrixGridStyle(matrix.columns.length)}
            >
              <span></span>
              <span></span>
              {matrix.columns.map((col) => (
                <span
                  key={col.key}
                  title={col.label}
                  className="min-w-0 text-center text-[11px] leading-tight font-semibold tracking-wide text-muted sm:text-[11.5px]"
                >
                  {/* จอเล็กใช้ชื่อย่อสองบรรทัด ชื่อเต็มอยู่ใน title ให้ชี้ดูได้ — ชื่อเต็มที่ 11px ชนกันเองที่ 375px */}
                  <span className="flex flex-col sm:hidden">
                    <span>{col.shortTop}</span>
                    <span>{col.shortBottom}</span>
                  </span>
                  <span className="hidden sm:inline">{col.label}</span>
                </span>
              ))}
              <span className="text-center text-[11px] leading-tight font-semibold tracking-wide text-muted sm:text-[11.5px]">
                รวม
              </span>
            </div>

            <DndContext id="dashboard-heatmap" sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-0.5 sm:gap-1.5">
                  {orderedPeople.map((person) => {
                    const row = matrixRowById.get(person.id);
                    if (!row) return null;
                    return (
                      <MatrixRow key={person.id} id={person.id} row={row} columns={matrix.columns} isAdmin={isAdmin} />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </section>
    </div>
  );
}
