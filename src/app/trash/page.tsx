import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "../AppShell";
import { loadAppData } from "../app-data";

export const metadata: Metadata = { title: "ถังขยะ · Workload Tracker" };

export default async function TrashPage() {
  const data = await loadAppData();
  if (!data) redirect("/login");

  /*
   * ถังขยะเป็นของ admin เท่านั้น — ตรวจซ้ำที่หน้านี้เอง ไม่พึ่ง middleware อย่างเดียว (แก้ B10)
   * middleware ตรวจแค่ว่า "มี token ที่ signature ถูก" ซึ่งบอกไม่ได้ว่าสิทธิ์ปัจจุบันเป็นอะไร
   * (ถอดสิทธิ์ admin ของใครไปแล้ว token เก่าของเขายังใช้ได้จนกว่าจะหมดอายุ)
   */
  if (!data.user.roles.includes("admin")) redirect("/");

  return <AppShell screen="trash" {...data} />;
}
