import { describe, expect, it } from "vitest";
import { formatLogDateTime, formatRelativeTime, formatShortDate, reminderUrgency } from "./board-derived";

/*
 * ชุดทดสอบวันที่/เวลา (คุม B12)
 *
 * หัวใจของบั๊กเดิม: โค้ดอ่านวันที่ด้วยเขตเวลาของ "เครื่องที่รัน"
 * เซิร์ฟเวอร์ตอน deploy จริงเป็น UTC ส่วนเบราว์เซอร์ผู้ใช้เป็น UTC+7 → ได้คนละวัน
 * ทุกเคสในไฟล์นี้จึงส่ง "จุดเวลา" ที่แน่นอนเข้าไป แล้วคาดหวังผลตามเวลาไทยเสมอ
 * → ถ้ามีใครเผลอเปลี่ยนกลับไปใช้ getDate()/getHours() ธรรมดา เทสต์กลุ่มนี้จะพังทันทีเมื่อรันบนเครื่อง UTC
 */

describe("formatShortDate", () => {
  it("แปลงเป็น วว/ดด/ปี พ.ศ. 2 หลัก", () => {
    expect(formatShortDate("2026-09-17")).toBe("17/09/69");
    expect(formatShortDate("2026-01-01")).toBe("01/01/69");
    expect(formatShortDate("2025-12-31")).toBe("31/12/68");
  });

  it("ค่าว่างหรือรูปแบบผิด คืน null ไม่ใช่ 'Invalid Date'", () => {
    expect(formatShortDate(undefined)).toBeNull();
    expect(formatShortDate("")).toBeNull();
    expect(formatShortDate("17/09/2026")).toBeNull();
  });
});

describe("formatLogDateTime", () => {
  it("แสดงเป็นเวลาไทยเสมอ (UTC+7)", () => {
    expect(formatLogDateTime("2026-09-16T07:30:05.000Z")).toBe("16/9/2569 14:30:05");
  });

  it("ข้ามเที่ยงคืนตามเวลาไทย ไม่ใช่ตามเวลา UTC", () => {
    // 17:30 UTC = 00:30 ของ "วันถัดไป" ตามเวลาไทย
    expect(formatLogDateTime("2026-09-16T17:30:00.000Z")).toBe("17/9/2569 00:30:00");
  });

  it("ค่าเสียคืนค่าว่าง ไม่พังทั้งหน้า", () => {
    expect(formatLogDateTime("ไม่ใช่วันที่")).toBe("");
  });
});

describe("reminderUrgency", () => {
  /** 23:00 ของวันที่ 16 ก.ย. ตามเวลาไทย */
  const lateNightThai = new Date("2026-09-16T16:00:00.000Z");
  /** 00:30 ของวันที่ 17 ก.ย. ตามเวลาไทย (ยังเป็นวันที่ 16 ถ้าดูด้วยเวลา UTC) */
  const afterMidnightThai = new Date("2026-09-16T17:30:00.000Z");

  it("ครบกำหนดภายใน 3 วัน = soon", () => {
    expect(reminderUrgency("2026-09-19", lateNightThai)).toBe("soon");
    expect(reminderUrgency("2026-09-16", lateNightThai)).toBe("soon");
    expect(reminderUrgency("2026-09-01", lateNightThai)).toBe("soon"); // เลยกำหนดแล้วก็ยังเร่งด่วน
  });

  it("เกิน 3 วัน = later", () => {
    expect(reminderUrgency("2026-09-20", lateNightThai)).toBe("later");
  });

  it("หลังเที่ยงคืนเวลาไทย ต้องนับเป็นวันใหม่แล้ว", () => {
    // วันเดียวกันเป๊ะ ๆ แต่ต่างกันครึ่งชั่วโมง: 20 ก.ย. เปลี่ยนจาก later เป็น soon เพราะวันนี้กลายเป็น 17 ก.ย.
    expect(reminderUrgency("2026-09-20", afterMidnightThai)).toBe("soon");
  });

  it("ไม่มีวันที่เตือน = ไม่มีระดับความเร่งด่วน", () => {
    expect(reminderUrgency(undefined, lateNightThai)).toBeUndefined();
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");

  it("นับถอยหลังตามช่วงเวลาที่ห่างจาก now ที่ส่งเข้ามา", () => {
    expect(formatRelativeTime("2026-09-16T11:59:30.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-16T11:45:00.000Z", now)).toBe("15m ago");
    expect(formatRelativeTime("2026-09-16T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-09-15T09:00:00.000Z", now)).toBe("yesterday");
    expect(formatRelativeTime("2026-09-10T12:00:00.000Z", now)).toBe("6d ago");
  });
});
