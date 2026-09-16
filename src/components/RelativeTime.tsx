"use client";

import { useSyncExternalStore } from "react";
import { formatLogDateTime, formatRelativeTime } from "@/app/board-derived";

/*
 * ตัวบอกว่า "ตอนนี้โค้ดกำลังทำงานอยู่บนเบราว์เซอร์แล้วหรือยัง"
 *
 * ไม่มีอะไรให้ subscribe จริง ๆ (ค่าไม่มีวันเปลี่ยนหลังหน้าโหลดเสร็จ) จึงคืนฟังก์ชันยกเลิกเปล่า ๆ
 * ประกาศไว้นอก component เพื่อให้เป็นฟังก์ชันตัวเดิมทุกครั้ง React จะได้ไม่ subscribe ใหม่ทุก render
 */
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * เวลาแบบ "2h ago" ที่ไม่ทำให้ HTML ฝั่งเซิร์ฟเวอร์กับฝั่งเบราว์เซอร์ไม่ตรงกัน (แก้ B12/C12)
 *
 * ปัญหาเดิม: ข้อความแบบสัมพัทธ์คำนวณจาก "ตอนนี้กี่โมง" ตอน render
 * เซิร์ฟเวอร์ render ตอนหนึ่ง เบราว์เซอร์ render อีกตอนหนึ่ง → ได้คนละข้อความ (just now vs 1m ago)
 * React จึงเตือน hydration mismatch ซึ่งเคยถูกกลบด้วย suppressHydrationWarning แทนที่จะแก้ต้นเหตุ
 *
 * วิธีแก้: ตอน render ฝั่งเซิร์ฟเวอร์และตอน hydrate ครั้งแรก แสดง "วันเวลาเต็ม" ซึ่งคงที่เสมอ
 * (ยึดเวลาไทย ไม่ขึ้นกับเขตเวลาของเครื่อง) แล้วค่อยสลับเป็นแบบสัมพัทธ์หลังจากนั้น
 * ใช้ useSyncExternalStore ไม่ใช่ useState+useEffect เพราะกฎ lint ของ React Compiler
 * ห้าม setState ใน effect (ดูกับดักข้อ 1 ใน PROGRESS-TRACKER.md)
 */
export function RelativeTime({ iso }: { iso: string }) {
  const hydrated = useSyncExternalStore(noopSubscribe, onClient, onServer);
  const absolute = formatLogDateTime(iso);

  return (
    <time dateTime={iso} title={absolute}>
      {hydrated ? formatRelativeTime(iso) : absolute}
    </time>
  );
}
