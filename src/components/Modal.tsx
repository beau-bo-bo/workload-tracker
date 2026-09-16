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
   * ── ตอนเปิดและตอนปิด dialog: ทำครั้งเดียวเท่านั้น ──────────────────────────
   *
   * ⚠️ deps ต้องเป็น [] เสมอ ห้ามใส่ onClose เข้าไปเด็ดขาด
   *
   * บั๊กที่เคยเกิดจริง (2026-09-16): เดิม deps เป็น [onClose] ซึ่ง component แม่สร้างฟังก์ชันใหม่ทุก render
   * → พิมพ์ข้อความ 1 ตัวอักษร = แม่ render ใหม่ = effect นี้ทำงานซ้ำ = โฟกัสเด้งกลับไปช่องแรกของ dialog
   *   (ผู้ใช้เจอตอนพิมพ์ "บันทึกช่วยจำ" ใน dialog ส่งตรวจ แล้วโฟกัสกระเด้งไป dropdown ทุกตัวอักษร)
   * ตัวดักปุ่มคีย์บอร์ดแยกไปอยู่ effect ล่างที่อัปเดต onClose ได้โดยไม่ยุ่งกับโฟกัส
   */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      // คืนโฟกัสให้ปุ่มที่เปิด dialog นี้ ไม่งั้นพอปิดแล้วโฟกัสเด้งกลับไปต้นหน้า
      previouslyFocused?.focus();
    };
  }, []);

  /*
   * ── ปุ่มคีย์บอร์ดของ dialog (แก้ U9) ──────────────────────────────────────
   * Esc = ปิด · Tab = วนอยู่ในกรอบ ไม่หลุดไปโดนปุ่มที่อยู่ข้างหลัง
   * effect นี้ผูกกับ onClose ได้ เพราะแค่ถอด/ใส่ตัวดัก event ใหม่ ไม่ได้ไปยุ่งกับโฟกัสของผู้ใช้
   */
  useEffect(() => {
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
    return () => document.removeEventListener("keydown", onKeyDown);
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
