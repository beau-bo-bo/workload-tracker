import fs from "node:fs";
import { SignJWT } from "jose";

const env = fs.readFileSync(".env.local", "utf8");
const key = new TextEncoder().encode(env.match(/^SESSION_SECRET=(.*)$/m)[1].trim());
const nowSec = Math.floor(Date.now() / 1000);
const token = await new SignJWT({ id: "8b0dbfb6-91d4-4ff5-89dd-d9ce47fd8b93", username: "probe", displayName: "Admin", roles: ["admin"] })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt(nowSec).setExpirationTime(nowSec + 3600).sign(key);

const base = process.argv[2];
for (let i = 1; i <= 3; i++) {
  const t0 = performance.now();
  const res = await fetch(base + "/api/perf", { headers: { cookie: `session=${token}` }, cache: "no-store" });
  const total = Math.round(performance.now() - t0);
  const body = await res.json().catch(() => null);
  if (!body || body.error) { console.log(`ครั้งที่ ${i}: status=${res.status}`, body); continue; }
  console.log(`\nครั้งที่ ${i} — เวลาที่ผู้เรียกรอทั้งหมด ${total} ms  (region=${body.region})`);
  console.log(`  ตรวจ session: ${body["ตรวจ session เสร็จภายใน (ms)"]} ms`);
  console.log(`  ฐานข้อมูล 8 คำสั่งพร้อมกัน: ${body["เรียกฐานข้อมูล 8 คำสั่งพร้อมกัน (ms)"]} ms`);
  console.log(`  เรียกซ้ำคำสั่งเดียวตอนอุ่นแล้ว: ${body["เรียกซ้ำคำสั่งเดียวตอนอุ่นแล้ว (ms)"]} ms`);
  console.log(`  ช้าสุด 3 ตัว: ${body.รายตัว.slice(0, 3).map((r) => `${r.label}=${r.ms}ms`).join(" · ")}`);
  const inside = body["ตรวจ session เสร็จภายใน (ms)"] + body["เรียกฐานข้อมูล 8 คำสั่งพร้อมกัน (ms)"] + body["เรียกซ้ำคำสั่งเดียวตอนอุ่นแล้ว (ms)"];
  console.log(`  → เวลาที่หายไปนอกเหนือจากงานข้างใน (เริ่มเครื่อง/ส่งข้อมูล): ${total - inside} ms`);
}
