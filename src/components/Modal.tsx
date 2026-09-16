"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";

/**
 * สิ่งที่โฟกัสได้ภายใน dialog — ใช้ทั้งตอนเลือกตัวแรกให้โฟกัส และตอนวน Tab ไม่ให้หลุดออกนอก
 *
 * ⚠️ ต้องตัดตัวที่ถูก disable ออกด้วย ไม่งั้น "ตัวสุดท้ายในกรอบ" อาจเป็นปุ่มที่โฟกัสไม่ได้จริง (เช่นปุ่มยืนยันที่ยังกดไม่ได้)
 *    แล้วการวน Tab กลับไปตัวแรกจะไม่ทำงานเลย — เจอตอนทดสอบจริงใน dialog "ส่งตรวจ" ที่ยังไม่ได้เลือกผู้ตรวจ
 */
const FOCUSABLE =
  "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /*
   * a11y ของ dialog (แก้ U9) — เดิมเป็นแค่กล่อง div ลอย ๆ:
   * กด Esc ไม่ปิด · กด Tab หลุดไปโดนปุ่มที่อยู่ข้างหลัง · หน้าจอข้างหลังเลื่อนตาม · โปรแกรมอ่านหน้าจอไม่รู้ว่านี่คือ dialog
   */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const items = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      // คืนโฟกัสให้ปุ่มที่เปิด dialog นี้ ไม่งั้นพอปิดแล้วโฟกัสเด้งกลับไปต้นหน้า
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
        onClick={stop}
      >
        <h3 id={titleId} className="font-display text-lg font-semibold text-text">
          {title}
        </h3>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
