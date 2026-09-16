import { describe, expect, it } from "vitest";
import { SESSION_DURATION_SECONDS, SESSION_RENEW_AFTER_SECONDS, shouldRenewSession } from "./session";

/*
 * ชุดทดสอบการต่ออายุ session (เพิ่ม 2026-09-16)
 *
 * โจทย์จากผู้ใช้: "ใช้เบราว์เซอร์เดิม ไม่ต้อง login ใหม่"
 * กลไก: middleware เซ็น token ใบใหม่ให้เมื่อใบที่ถืออยู่เก่ากว่า 1 วัน → คนที่เข้าใช้เรื่อย ๆ จะไม่มีวันหลุด
 */

const DAY = 60 * 60 * 24;
const now = 1_760_000_000; // จุดเวลาอ้างอิงคงที่ ไม่พึ่งนาฬิกาเครื่อง

describe("shouldRenewSession", () => {
  it("เพิ่ง login มา ยังไม่ต้องต่ออายุ (ไม่เขียนคุกกี้ซ้ำทุก request)", () => {
    expect(shouldRenewSession(now, now)).toBe(false);
    expect(shouldRenewSession(now - 60, now)).toBe(false);
    expect(shouldRenewSession(now - DAY + 1, now)).toBe(false);
  });

  it("token เก่ากว่า 1 วัน = ต่ออายุ", () => {
    expect(shouldRenewSession(now - DAY, now)).toBe(true);
    expect(shouldRenewSession(now - DAY * 3, now)).toBe(true);
    expect(shouldRenewSession(now - DAY * 6.9, now)).toBe(true);
  });

  it("token ที่ไม่มี iat (เช่นของเก่าที่เซ็นก่อนหน้านี้) ไม่ต่ออายุ แต่ก็ไม่พัง", () => {
    expect(shouldRenewSession(0, now)).toBe(false);
    expect(shouldRenewSession(Number.NaN, now)).toBe(false);
  });

  it("ช่วงต่ออายุต้องสั้นกว่าอายุ session มาก ๆ ไม่งั้นคนใช้งานปกติจะหลุดก่อนได้ต่ออายุ", () => {
    expect(SESSION_RENEW_AFTER_SECONDS).toBeLessThan(SESSION_DURATION_SECONDS / 2);
  });
});
