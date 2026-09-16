# PROGRESS-TRACKER.md — Current Status

## Current Phase:
**Phase R — Code Review & Remediation (2026-09-15/16) + งานปรับตามคำสั่งผู้ใช้ (2026-09-16)** — เซสชันตรวจโค้ดทั้งระบบโดยผู้ตรวจอิสระ แล้วแก้ตามที่ผู้ใช้สั่งทีละข้อ
(ไม่ใช่ Phase สร้างฟีเจอร์ตาม PLAN.md เดิม — Phase 6 ยังรอ Approval อยู่เหมือนเดิม, Phase 7 ยังไม่เริ่ม)

## Status:
**แก้แล้ว 6 ชุดตามที่ผู้ใช้สั่ง** (ปิดช่องโหว่ความปลอดภัย · ดึง SQL ลง repo · บั๊กย้อนสถานะ+dialog บันทึกย้อนหลัง · ผูกคนด้วย id · ประสิทธิภาพ · **ชุดที่ 6 (2026-09-16): The Wall badge แบบ unread + ป้าย New · ตัวเลขถาวรท้ายแท็บ Tagged/Mine · เลิกใช้ Private Memo · Dashboard เหลือแค่ Heat Map · ลบ RPC ที่ตายแล้ว 4 ตัว (A4) · **Phase E Accessibility ครบ E1–E8** · **Phase F1 แยก 5 หน้าจอเป็น route จริง**) — **ทดสอบผ่านระบบจริงครบทุกข้อ ยกเว้นที่ระบุไว้ใน Handoff Note**
ดูรายละเอียดที่ `CODE-REVIEW.md` (ผลตรวจ) + `FIX-INSTRUCTIONS.md` (แผนงานที่เหลือ) + Handoff Note ท้ายไฟล์นี้

**สถานะเดิมที่ยังค้างอยู่ — Phase 6 (2026-09-15 ดึกที่สุด)** Phase 1-4 อนุมัติแล้วครบ Phase 5 ข้อ 1 (Workload Dashboard) เสร็จและทดสอบผ่าน Browser จริงแล้ว — ข้อ 2-3 เดิมของ Phase 5 ถูกย้ายไปรวมเป็น **Phase 7** แทน (Edge Cases & Validation + Final Review รวบยอดหลัง Phase 6 เสร็จจริง) — **Phase 6 (ฟีเจอร์บอร์ด/โน้ต ชื่อ UI จริงคือ "The Wall"/"Memo") สร้างเสร็จและผ่านการ polish ตาม feedback ผู้ใช้แบบ real-time หลายรอบแล้ว** ยังไม่มีคำอนุมัติ Phase 6 อย่างเป็นทางการ (รายละเอียด Phase 6 ฉบับเต็มอยู่ใน [`PROGRESS-ARCHIVE.md`](PROGRESS-ARCHIVE.md) หัวข้อ Handoff Note "2026-09-15 ดึกที่สุด")

## Tech Stack (บันทึกไว้เพื่อใช้ต่อในทุก Phase):
- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- Supabase (Postgres) — project "workload-tracker" (ref: kalooxclwbnjunuxbjst, region ap-southeast-1)
- Auth: ตาราง `users` เอง (ไม่ใช้ Supabase Auth) + RPC functions ที่ตรวจ/เข้ารหัสรหัสผ่านด้วย pgcrypto ฝั่ง Postgres โดยตรง
  - ⛔️ **บรรทัดนี้เคยเขียนว่า "เรียกผ่าน anon key เท่านั้น ไม่ต้องใช้ service role key" — ข้อมูลนั้นผิดและเป็นช่องโหว่ระดับยึดระบบ แก้แล้ว 2026-09-15 (ดู `CODE-REVIEW.md` ข้อ S1)**
  - ✅ **ของจริงตอนนี้:** เรียก Supabase ด้วย **`SUPABASE_SERVICE_ROLE_KEY` จากฝั่งเซิร์ฟเวอร์เท่านั้น** (`src/lib/supabase.ts` มี `import "server-only"`)
    RPC ทุกตัวถูก `revoke execute` จาก `anon`/`authenticated` แล้ว (ดู `supabase/migrations/0004_lockdown_rpc_grants.sql`)
  - ⚠️ **service_role ข้ามด่านตรวจทุกอย่างของฐานข้อมูล** → **ทุก Server Action ต้องตรวจสิทธิ์ผู้ใช้เองก่อนเสมอ** และ **ห้ามใช้ prefix `NEXT_PUBLIC_` กับคีย์ Supabase เด็ดขาด**
- SQL ทั้งหมดอยู่ใน `supabase/migrations/` แล้ว (0001–0008) — **ทุกการเปลี่ยนแปลงฐานข้อมูลต้องเขียนเป็นไฟล์ใหม่ในโฟลเดอร์นี้เสมอ ห้ามแก้ผ่าน Dashboard/MCP แล้วไม่มีไฟล์**
- Test: `npm test` (vitest ^2 — ใช้ v2 เพราะ v5 ต้องการ `@types/node` ใหม่กว่าที่โปรเจกต์ใช้) ครอบ `src/app/task-workflow.ts`
- Roles: คอลัมน์ `users.roles` เป็น `user_role[]` (array) — 1 บัญชีถือได้หลาย role พร้อมกัน (เช่น Owner + Inspector) ตามที่ผู้ใช้ยืนยัน
- Session: JWT เซ็นเองด้วย `jose` เก็บใน httpOnly cookie ผ่าน `src/lib/session.ts` / `src/lib/auth.ts`
- Route protection: `src/middleware.ts`
- ปลายทาง deploy สุดท้าย: Vercel + Supabase (ตามที่ผู้ใช้ระบุไว้)
- Design system (Phase 2): CSS custom properties + Tailwind v4 `@theme inline` ใน `src/app/globals.css` (โทนพาสเทลอิง กฟผ., light/dark) ฟอนต์ IBM Plex Sans Thai (`src/app/layout.tsx`) + Chakra Petch (เฉพาะหัวข้อโหมดมืด ผ่าน `--font-display`) ไอคอนเส้น minimal อยู่ที่ `src/components/icons.tsx` (EditIcon, ArchiveIcon, TrashIcon, RestoreIcon, BackIcon) — ห้ามใช้ emoji แทนไอคอน action (ยกเว้น 🔥 ที่เป็น content marker ตาม PRODUCT.md)
- โครงสร้างหน้าหลัก (Phase 2): `src/app/AppShell.tsx` (client component เดียว คุม state ทั้งหมด: tabs, meetings mock data, trash) → `MeetingCard.tsx`, `TrashView.tsx`, types ใน `board-types.ts` — ทุกอย่างยังเป็น Mock Data (React state) ยังไม่เชื่อม Supabase สำหรับครั้งที่ประชุม/วาระ
- หน้า `/admin/users` (2026-09-14 รื้อใหม่เป็น CSS Grid list + Drag and Drop, ดู DESIGN.md ข้อ 2): แถวผู้ใช้แต่ละคนคุมโดย `UserRow.tsx` (client, ต่อ `UserList.tsx` ที่คุม `DndContext`) — เดิมชื่อ `UserTableRow.tsx`/`ReorderUserButtons.tsx`/`ResetPasswordRow.tsx` ถูกลบรวมเข้ามาในนี้แล้ว — กดไอคอนดินสอแก้ได้ทั้งชื่อที่แสดง+Role+**กลุ่มตรวจ** พร้อมกัน (ปุ่มบันทึก/ยกเลิกอยู่ท้ายแถวคู่กับปุ่มลบ ใช้เทคนิค `form` attribute ให้ปุ่มอยู่นอก `<form>` ได้), ปุ่มลบเป็นไอคอนถังขยะสีแดง (`DeleteUserButton.tsx`, มี native confirm), Reset Password และ "+ เพิ่มผู้ใช้งาน" เป็นปุ่มยุบ/ขยายเหมือนกัน (ไม่โชว์ฟอร์มค้างไว้) จัดลำดับด้วย Drag and Drop (ไม่มีปุ่มขึ้น/ลงแล้ว) — RPC ที่ใช้จริงตอนนี้: `login`, `admin_create_user`, `admin_update_user` (แก้ชื่อ+role+review_groups พร้อมกัน), `admin_delete_user` (กันลบตัวเอง), `admin_reset_password`, `admin_list_users`, `admin_set_user_order` (จัดลำดับแบบ batch), `change_own_password` — RPC เดิมชื่อ `admin_update_roles`/`admin_rename_user`/`admin_reorder_user` (สลับทีละคู่) ถูกแทนที่แล้ว (ของเก่ายังอยู่ใน DB แต่โค้ดไม่เรียกใช้แล้ว)
- Board (Phase 3): dropdown "เลือกผู้รับผิดชอบ" ใน `CreateTaskForm.tsx` ดึงรายชื่อ Owner จริงจาก Supabase ผ่าน RPC `list_users_by_role(p_role)` (public ไม่เช็ค admin, คืน id+display_name+**review_groups** ตาม role, เพิ่ม review_groups 2026-09-14) — fetch ฝั่ง server ใน `page.tsx` แล้วส่งเป็น prop `owners`/`inspectors` ผ่าน `AppShell.tsx` → `MeetingCard.tsx`/แท็บ "อื่น ๆ" → `CreateTaskForm.tsx` ไม่ hardcode list แล้ว — `inspectors` ที่ส่งให้การ์ดในโหมด Board/Excom ถูกกรองตาม Sub-tab ที่เลือกอยู่ก่อนส่งลงไป (`visibleInspectors` ใน `AppShell.tsx`, ดู DESIGN.md ข้อ 4.5) ส่วนแท็บ "อื่น ๆ" ยังส่ง `inspectors` เต็มไม่กรอง (ไม่มี Sub-tab ให้อิง) — วาระ/ครั้งที่ประชุม (tasks/meetings) เองยังเป็น Mock React state เหมือนเดิม ยังไม่มีตารางจริงใน Supabase สำหรับสองอย่างนี้
- Workload Dashboard (Phase 5, 2026-09-15): หน้า `WorkloadDashboard.tsx` (เปิดจากไอคอนกราฟที่ Header) มีลำดับคนของตัวเอง **แยกขาดจาก `/admin/users`** — คอลัมน์ `users.dashboard_sort_order` (เริ่มต้น copy จาก `sort_order` ตอน migrate แต่แก้ไขอิสระได้ตั้งแต่นั้น) + RPC ใหม่ `list_workload_people()` (public, คืนทุกคนที่มี role owner หรือ inspector เรียงตามคอลัมน์นี้) และ `admin_set_dashboard_order(p_admin_id, p_user_ids[])` (เช็ค admin, batch update, ก็อปแพทเทิร์น `admin_set_user_order`) — fetch ใน `page.tsx` ส่งเป็น prop `workloadPeople` (คนละตัวกับ `owners`/`inspectors`) — Drag and Drop ในหน้านี้ใช้ `@dnd-kit` เหมือน `/admin/users` แต่ลากได้เฉพาะ role Admin (`isAdmin` prop คุมทั้ง 2 ตาราง Summary+Heat Map ให้ลำดับซิงค์กันเสมอ)

## สถานะการอนุมัติ (Approval Status)
- **สรุปสถานะอนุมัติ:** Phase 1 ✅ อนุมัติแล้ว | Phase 2 ✅ อนุมัติแล้ว | Phase 3 ✅ อนุมัติแล้ว (2026-09-13 ผู้ใช้ยืนยัน "ถือว่า Phase 3 อนุมัติแล้ว เริ่ม Phase 4 เลย") | Phase 4 ✅ อนุมัติแล้ว (2026-09-15 ผู้ใช้ยืนยัน "จบเฟสนี้ได้" — รวม UI/UX polish พ่วงท้ายทั้งหมดที่ทำระหว่างทางด้วย) | Phase 5 ✅ อนุมัติแล้ว | **Phase 6 ✅ อนุมัติแล้ว (2026-09-16 ผู้ใช้ยืนยัน "Phase 6 เห็นชอบแล้ว")**

**Phase 6** (The Wall/Memo) — ✅ **อนุมัติแล้ว 2026-09-16**
**Phase 7** (Edge Cases & Final Review) — ยังไม่เริ่ม
**Phase R** (Code Review & Remediation) — แก้ไปแล้ว 6 ชุด ดู Handoff Note ท้ายไฟล์

---

## 📁 ประวัติเก่าย้ายไปที่ไหน

ไฟล์นี้เคยโตถึง **483KB / 1,059 บรรทัด** (Handoff Note สะสม 10 ฉบับ) จนเปิดอ่านในแชทใหม่ไม่ไหว
**ย้ายส่วนที่ถูกแทนที่แล้วออกไปที่ [`PROGRESS-ARCHIVE.md`](PROGRESS-ARCHIVE.md) เมื่อ 2026-09-15/16:**

- History / Approved Logs รายวัน (2026-09-13 → 2026-09-15)
- Handoff Note ฉบับเก่า 9 ฉบับ (2026-09-13 → 2026-09-15 ดึกที่สุด)

⚠️ เนื้อหาในไฟล์นั้น **ล้าสมัยแล้วและบางส่วนขัดกับระบบปัจจุบัน** (เช่นยังเขียนว่าใช้ anon key) เก็บไว้อ้างอิงย้อนหลังเท่านั้น

**กฎการดูแลไฟล์นี้ต่อไป:** เขียน Handoff Note ฉบับใหม่ต่อท้ายไฟล์นี้ แล้ว**ย้ายฉบับเก่าไป `PROGRESS-ARCHIVE.md` ทันที**
อย่าปล่อยให้สะสมจนใหญ่อีก — ไฟล์นี้ควรมี Handoff Note **ฉบับเดียว** เสมอ

---

## 🔖 สรุปสถานะสำหรับส่งต่อ Chat ใหม่ (Handoff Note — **ชุดที่ 6: The Wall + Dashboard ตามคำสั่งผู้ใช้, 2026-09-16** — **ฉบับล่าสุด ให้ยึดฉบับนี้เท่านั้น ฉบับก่อนหน้าย้ายไป `PROGRESS-ARCHIVE.md` แล้ว**)

**อ่านก่อนเสมอ:** `START-HERE.md` → `AGENTS.md` (โดยเฉพาะข้อ 3 Approval Gate และ 6.1 กฎเทคนิค) → `FIX-INSTRUCTIONS.md` (บันทึกการตัดสินใจของผู้ใช้ ห้ามตีความใหม่) → Handoff Note ฉบับนี้

> **⚠️ สถาปัตยกรรมความปลอดภัยและกฎฐานข้อมูลทั้งหมดยังเหมือนเดิมทุกข้อ** (service_role ฝั่งเซิร์ฟเวอร์เท่านั้น · RPC ปิดจาก anon/authenticated · ทุกการเปลี่ยนแปลง DB ต้องเป็นไฟล์ใน `supabase/migrations/`) — สรุปเต็มอยู่ใน `START-HERE.md` ข้อ 4 และ `AGENTS.md` ข้อ 6.1

---

### เซสชันนี้ทำอะไร — ผู้ใช้สั่งมา 4 ข้อรวด แล้วบอกว่า "เริ่มได้เลย"

**ไม่ใช่ Phase สร้างฟีเจอร์ใหม่ตาม `PLAN.md`** — Phase 6 (The Wall/Memo) ยังรอ Approval อยู่เหมือนเดิม · Phase 7 ยังไม่เริ่ม

#### 1. Red Badge ของ The Wall = "ข้อความใหม่ที่ Tag ฉันแล้วยังไม่ได้กดดู"
- เดิมนับ memo ที่เกี่ยวกับฉันทั้งหมด → **ไม่มีวันเป็นศูนย์** (คือปัญหาข้อ 6 ที่ค้างไว้ว่า "ผู้ใช้ขอคุยหลักการก่อน" — ตอนนี้ผู้ใช้ให้หลักการมาแล้วและทำเสร็จแล้ว)
- **ไม่ได้สร้างตาราง `board_post_reads` ตามที่รายงานตรวจโค้ดเสนอไว้** — ใช้คอลัมน์ `board_posts.seen_by uuid[]` แทน
  เหตุผล: ผู้ใช้กังวลเรื่อง "เดี๋ยวรก db" และ memo เป็นของชั่วคราวที่ต้องถูกลบอยู่แล้ว → ลบ memo = ข้อมูลการอ่านหายไปพร้อมกัน ไม่มีแถวกำพร้าค้าง
- **คำถามที่ผู้ใช้ถามเองว่า "กดเข้าไปแล้วจะรู้ได้อย่างไรว่าอันไหนคือข้อความใหม่"** → ตอบด้วยป้าย **New** (สีน้ำเงิน `bg-accent`) + กรอบน้ำเงินบนการ์ด
  ค้างไว้ตลอดรอบที่เปิดหน้านั้นอยู่ (`newPostIds` ใน `AppShell.tsx`) — **ห้ามผูกป้าย New กับ `post.unread` ตรง ๆ** เพราะจะหายพร้อม badge ทันทีจนไม่ทันเห็น
- กดเข้าหน้า The Wall = อ่านทั้งหมด (`openWall()` → `markWallSeenAction()`) ไม่ใช่กดทีละใบ · คนเขียนไม่ถูกนับเป็นของใหม่ให้ตัวเอง (insert พร้อม `seen_by = array[ผู้เขียน]`)
- **`mark_board_posts_seen` ตั้งใจไม่บวก `version`** — การอ่านไม่ใช่การแก้เนื้อหา ถ้าบวกจะทำให้คนที่เปิด dialog แก้ memo ค้างไว้โดน `version_conflict` เพราะคนอื่นแค่เปิดดู

#### 2. ตัวเลขท้ายแท็บ Tagged / Mine (ถาวร)
- เป็น **จำนวนทั้งหมด** ของแท็บนั้น ไม่เกี่ยวกับการอ่าน ลดลงเมื่อ memo ถูกลบเท่านั้น (คำสั่งผู้ใช้ตรง ๆ)
- ใช้ **สีกลาง ไม่ใช่สีแดง** เพื่อไม่ให้สับสนกับ Red Badge แจ้งเตือน · แท็บ All ไม่มีตัวเลข

#### 3. เลิกใช้ Private Memo ทั้งฟีเจอร์
- เหตุผลของผู้ใช้: "มองไม่เห็น คุมจำนวนไม่ได้ เดี๋ยวรก db" + **หลักการของ The Wall คือแปะสิ่งที่ต้องทำ/แจ้งข่าว แล้วลบทิ้งเมื่อทำเสร็จหรือเลย event ไปแล้ว**
- ลบคอลัมน์ `is_private` ทิ้งจริงใน migration `0007` — **ตรวจก่อนลบแล้วว่ามีโพสต์ที่ตั้งส่วนตัวอยู่ 0 รายการ** (ทั้งที่ใช้งานอยู่และในถังขยะ) จึงไม่มีบันทึกของใครกลายเป็นสาธารณะ
- `LockIcon` ยังอยู่ในไฟล์ icons แต่ไม่มีใครเรียกใช้แล้ว · **ห้ามเสนอฟีเจอร์นี้กลับมาอีก**

#### 4. Dashboard เหลือแค่ Heat Map (สั่งพร้อมกัน 3 ข้อข้างบน)
- ผู้ใช้สั่งตัด "ตารางสรุปรายคน" (Assigned/On hand/In Process/Done/งานที่ต้องตรวจ) ออก เพราะซ้ำกับ Heat Map
- ลบ `SummaryRow`/`countBadge` ใน `WorkloadDashboard.tsx` และ `workloadSummary()`/`PersonWorkload` ใน `board-derived.ts`
- ฟังก์ชันภายใน `onHandCount`/`inProcessCount`/`toReviewCount` **ยังอยู่** เพราะ Heat Map ใช้ต่อ · Drag and Drop จัดลำดับยังทำงานเหมือนเดิม (เหลือตารางเดียว)

#### 5. (ต่อเนื่องในเซสชันเดียวกัน) A4 — ลบฟังก์ชันที่ตายแล้วออกจากฐานข้อมูล
- ลบ 4 ตัวที่ถูกแทนที่ไปแล้วแต่ยังค้างอยู่: `admin_rename_user`, `admin_reorder_user`, `admin_update_roles`, `update_meeting` (migration `0008`)
- **ไม่ใช่แค่เรื่องความสะอาด** — ของพวกนี้เป็น SECURITY DEFINER ที่ยังทำงานได้จริง ถ้าสิทธิ์ถูกเปิดพลาดวันหนึ่งจะได้พฤติกรรมคนละแบบกับระบบปัจจุบันเงียบ ๆ
- ตรวจ 3 ชั้นก่อนลบ: grep ทั้ง `src/` ทีละชื่อ (0 ครั้งทั้ง 4 ตัว) · ไล่ `pg_get_functiondef` ทุกฟังก์ชันว่าไม่มีใครเรียกกันเอง · ไม่มี trigger ใน `public`
- ผลหลังลบ: เหลือ 38 ฟังก์ชัน · ตายแล้ว 0 · `anon`/`authenticated` เรียกได้ 0
- **ทดสอบผ่านหน้าจอจริงครบแล้ว** (ผู้ใช้ล็อกอินเป็น admin ให้เอง — assistant ไม่กรอกรหัสผ่านเอง เป็นข้อห้ามถาวร):
  `updateUserAction` (แก้ผู้ใช้) · `setUserOrderAction` (ลากจัดลำดับ) · `updateMeetingDetailsAction` (แก้ครั้งที่ประชุม) → **200 ทุกตัว**
  ก่อนหน้านั้นยังทดสอบระดับฐานข้อมูลด้วยการเรียกทั้ง 3 ฟังก์ชันด้วยค่าเดิมใน `do $ ... raise exception` เพื่อบังคับ rollback → ผ่านหมดโดยไม่มีอะไรถูกบันทึกจริง
- **ผลข้างเคียงจากการทดสอบ (แจ้งไว้ให้ครบ):** ลำดับผู้ใช้ถูกสลับระหว่างทดสอบลาก แล้ว**คืนกลับเป็นลำดับเดิมครบทั้ง 13 คนแล้ว** (ตรวจกับฐานข้อมูลยืนยันแล้ว) · `meetings.version` ของครั้งที่ 10/2569 ขยับ 4 → 5 จากการกดบันทึกด้วยค่าเดิม (เลข version ใช้กันแก้ชนกันเท่านั้น ไม่กระทบข้อมูล)
- **บทเรียนเครื่องมือ:** `left_click_drag` ของเบราว์เซอร์อัตโนมัติ **ลากกับ `@dnd-kit` ไม่แม่น** (สลับผิดแถวและบางครั้งไม่ขยับเลย) วิธีที่ได้ผลคือส่ง `pointerdown` → `pointermove` ทีละสเต็ปพร้อมหน่วงเวลา → `pointerup` ผ่าน javascript

#### 6. Phase E — Accessibility ครบ E1–E8 (ไม่มีการเปลี่ยนแปลงฐานข้อมูลในชุดนี้)

| ข้อ | ทำอะไร |
|---|---|
| E1 | **Modal เต็มรูปแบบ** — `role="dialog"`/`aria-modal`/`aria-labelledby`, Esc ปิด, focus trap, ล็อกพื้นหลังไม่ให้เลื่อน, ปิดแล้วคืนโฟกัสให้ปุ่มที่เปิด, เพิ่ม `max-h-[90vh]` กันเนื้อหาล้นจอเตี้ย |
| E2 | **แถววาระ + การ์ด memo กดด้วยคีย์บอร์ดได้** — ชื่อวาระ/ตัวข้อความ memo เป็น `<button>` จริง + `aria-expanded`/`aria-controls` |
| E3 | **กรอบโฟกัสกลาง** `:focus-visible` ใน `globals.css` (ชนะ `outline-none` ของ Tailwind เพราะอยู่นอก `@layer`) |
| E4 | **ตัวอักษรขั้นต่ำ 11px** ทั้งโปรเจกต์ (แก้ 23 จุด) + `EMPTY_MARK_CLASS` `/40` → `/70` ให้ contrast ผ่านเกณฑ์ |
| E5 | **ปุ่มงานบอกสถานะระหว่างรอ** — state `busy` ใน `TaskRow` ปิดปุ่มทุกตัว + ขึ้น "กำลังบันทึก..." กันกดรัวจนเกิด version_conflict ปลอม |
| E6 | `task.owner` ว่างแสดง `EMPTY_MARK` — **ตรวจแล้วว่ามีอยู่ก่อนหน้านี้แล้ว** (`TaskRow.tsx` `ownerName || EMPTY_MARK`) ไม่ต้องแก้ |
| E7 | **วันที่/เวลายึดเวลาไทยเสมอ** + ถอด `suppressHydrationWarning` 8 จาก 9 จุด |
| E8 | **Legend ของ Heat Map** ใช้ `heatCellClass()` ตัวเดียวกับตารางจริง |

**ปรับเพิ่มตามที่ผู้ใช้สั่งหลังตรวจรอบแรก (2026-09-16):**
- **Heat Map ไล่สี 3 ระดับ:** 1-2 งาน (อ่อน) · 3-4 งาน (กลาง) · 5 งานขึ้นไป (เข้ม) — ผู้ใช้ปรับเกณฑ์รอบสองจาก 1-3/4-6/7+ — เพิ่ม token ใหม่ `--pending-mid` ทั้งโหมดสว่างและมืด (**ห้ามใช้สีโปร่งแสงทับ token เดิมตามกฎโปรเจกต์**)
- **หัวคอลัมน์ Heat Map บนมือถือ:** `B Res` → `B Re` · `E` → `Ex` · `E Res` → `Ex Re`
- **หน้าหลักบนมือถือ:** timeline + แถว "เอกสารรอตรวจอยู่ที่" ลดเหลือ 11px (จบใน 1 บรรทัด) · หัวคอลัมน์ "ผู้รับผิดชอบ" เหลือ 2 บรรทัดโดย**ขยายคอลัมน์เป็น `3.25rem` แทนการลดตัวอักษร** เพราะ 11px คือพื้นล่างตามเกณฑ์อ่านออก (ลอง `3.5rem` แล้วชื่อวาระถูกเบียดจนยาวเป็น 3 บรรทัด)

**สิ่งที่ต้องรู้ถ้าทำต่อ:**
- **ตัวเลือก focusable ของ Modal ต้องมี `:not([disabled])`** — ตอนแรกลืม แล้ว "ตัวสุดท้ายในกรอบ" กลายเป็นปุ่มยืนยันที่ยัง disable อยู่ ทำให้การวน Tab ตายสนิท (เจอตอนทดสอบจริง ไม่ใช่ตอนอ่านโค้ด)
- **`<RelativeTime>` ใช้ `useSyncExternalStore` ไม่ใช่ `useState`+`useEffect`** — เขียนแบบ effect แล้ว lint เพิ่มขึ้น 1 error ทันที (`react-hooks/set-state-in-effect` ของ React Compiler ดูกับดักข้อ 1)
- **พอตัวอักษรขึ้นเป็น 11px หัวคอลัมน์ Heat Map ชนกันเองบนมือถือ** → จอเล็กเปลี่ยนเป็นชื่อย่อ 2 บรรทัด (B/Res, B/ร่าง, …) จอ `sm:` ขึ้นไปยังเป็นชื่อเต็มเหมือนเดิม
- **ยังเหลือ `suppressHydrationWarning` 1 จุดที่ `<html>`** เพราะ script ตั้งธีมทำงานก่อน React (ถ้าถอดจะมี warning จริงและจอกะพริบขาวก่อนเข้าโหมดมืด) — เขียนเหตุผลกำกับไว้ในไฟล์แล้ว **ห้ามลอกไปใส่ที่อื่น**

**ทดสอบจริงในเบราว์เซอร์ (ไม่ใช่แค่ build ผ่าน):**
- กด Tab เข้าถึงแถววาระได้จริง · `:focus-visible` ทำงาน (ค่า computed จริง = `rgb(51,81,125)` คือสี accent ไม่ใช่กรอบ default ของเบราว์เซอร์)
- Modal: โฟกัสเด้งเข้า dialog ตอนเปิด · Tab จากตัวสุดท้ายวนกลับตัวแรก · Esc ปิดแล้ว**คืนโฟกัสกลับไปที่ปุ่ม "ส่งตรวจ" ที่เปิดมันจริง** · `body` ถูกล็อกและปลดล็อกถูกต้อง
- เปิด tab ใหม่สะอาด ๆ แล้วโหลดหน้า: **ไม่มี hydration warning เหลือเลย**
- `<RelativeTime>` แสดง "14h ago" พร้อม tooltip เวลาไทย (12:05 UTC → 19:05 ตรงตามที่ควรเป็น)
- มือถือ 375px: Heat Map และหน้าหลักไม่มี scroll แนวนอน หัวคอลัมน์ไม่ชนกัน

**ยังทำไม่ได้ (รายงานตามจริง):**
- **วัด Lighthouse Accessibility ≥ 90 ตามเกณฑ์ผ่าน Phase E** — เบราว์เซอร์ที่ assistant ใช้รัน Lighthouse ไม่ได้ ต้องให้ผู้ใช้เปิด DevTools รันเอง
- **กด Enter/Space บนปุ่มด้วยคีย์บอร์ดจริง** — เครื่องมืออัตโนมัติส่งคีย์แล้วปุ่มไม่ทำงาน **พิสูจน์แล้วว่าเป็นข้อจำกัดของเครื่องมือ ไม่ใช่ของแอป** โดยสร้างปุ่ม `<button>` เปล่า ๆ ขึ้นมาในหน้าเดียวกันแล้วกด Enter ก็ไม่ทำงานเหมือนกัน (ส่วนการคลิกและการกด Esc ทำงานปกติทั้งคู่)

#### 7. Phase F1 — แยก 5 หน้าจอเป็น route จริง (ไม่มีการเปลี่ยนแปลงฐานข้อมูลในชุดนี้)

**ปัญหาเดิม:** ทั้งแอปอยู่ที่ `/` เดียว สลับหน้าจอด้วย state → กด Back ของเบราว์เซอร์ = หลุดออกจากแอป · refresh แล้วเด้งกลับหน้าแรกเสมอ · ส่งลิงก์เฉพาะหน้าไม่ได้

**ตอนนี้:** `/` (หน้าหลัก) · `/board` (The Wall) · `/my-tasks` · `/dashboard` · `/trash` — แต่ละ route มีชื่อแท็บเบราว์เซอร์ของตัวเอง

**วิธีที่เลือกและเหตุผล (สำคัญสำหรับคนทำต่อ):**
- สร้าง `src/app/app-data.ts` เป็น**ตัวโหลดข้อมูลกลาง** (`loadAppData()`) ย้ายมาจาก `page.tsx` — ทุก route เรียกตัวนี้แล้วส่งให้ `<AppShell screen="..." />`
- **ตั้งใจไม่แตก `AppShell` ออกเป็น 5 ไฟล์** เพราะ Header (เลขแจ้งเตือนของทั้งงานและ memo) ต้องใช้ข้อมูลชุดเต็มทุกหน้าอยู่แล้ว การแตกจะได้แค่โค้ดซ้ำ 5 ที่
  → **ผลข้างเคียงที่ต้องบันทึกตามจริง: prop drilling ที่แผนเดิมคาดว่าจะหายไป ยังอยู่เหมือนเดิม** ถ้าจะลดจริงต้องทำ F4 แยกต่างหาก
- ปุ่ม Header เปลี่ยนเป็น `<Link href>` → Next.js prefetch ให้ กดแล้วขึ้นเร็วขึ้น และคลิกกลางเปิดแท็บใหม่ได้
- **ได้ B9 + B10 ไปด้วยในตัว:** ทุกหน้า `redirect("/login")` เมื่อไม่มี session (เดิม `return null` = จอขาวเปล่า) และ `/trash` ตรวจสิทธิ์ admin ซ้ำในหน้าเอง ไม่พึ่ง middleware อย่างเดียว

**จุดที่ต้องระวังตอนแก้ต่อ:**
- `AppShell` ถูก **mount ใหม่ทุกครั้งที่เปลี่ยนหน้า** → state ชั่วคราว (toast / ข้อความข้อมูลชนกัน / แท็บที่เลือก) รีเซ็ต ซึ่งตั้งใจให้เป็นแบบนั้น
- จังหวะ "เพิ่งเปิดหน้า The Wall" ที่ใช้ทำป้าย **New** ย้ายจาก `openWall()` (ตอนกดปุ่ม) มาเป็น `useState` แบบ initializer + `useEffect` ตอน mount ของ `/board`
  **ห้ามเปลี่ยนไปใช้ setState ใน effect** เพื่อล้าง badge (ติดกฎ lint ของ React Compiler) — ตอนนี้ badge หักตัวที่เพิ่งอ่านด้วยการ**คำนวณ** ผ่าน `boardPostUnreadCount(posts, userId, justRead)` แทน

**ทดสอบจริงในเบราว์เซอร์:**
- กดไอคอน The Wall → URL เป็น `/board` และชื่อแท็บเปลี่ยนตาม
- **กด Back → กลับมาหน้าหลักในแอป (ไม่หลุดออกไปไหน)** · กด Forward → กลับไป `/board`
- **refresh ที่ `/dashboard` → ยังอยู่ที่ Dashboard** (เดิมเด้งกลับหน้าแรก)
- พิมพ์ `/trash`, `/my-tasks` ตรง ๆ เข้าได้ถูกหน้า · ปุ่ม "กลับหน้าหลัก" ทุกหน้าไปที่ `/`
- เปิดแท็บใหม่สะอาด ๆ เดินครบ `/` → `/board` → `/dashboard` แล้ว **ไม่มี error ใน console**

**ยังไม่ได้ทดสอบ:** `/trash` กับบัญชีที่ไม่ใช่ admin (ต้องสลับบัญชีทับ session ที่ผู้ใช้ล็อกอินค้างไว้ จึงไม่ทำ) — โค้ดใช้กฎเดียวกับที่ middleware ใช้อยู่แล้ว

#### 8. ขึ้นใช้งานจริงแล้ว (2026-09-16)

| | |
|---|---|
| เว็บจริง | **https://workload-tracker-kappa.vercel.app** |
| โค้ด | **https://github.com/beau-bo-bo/workload-tracker** (private — ในเอกสารมีชื่อคนจริงและรายละเอียดภายใน) |
| วิธี deploy | push ขึ้น `main` → Vercel build + deploy เองอัตโนมัติ |

- **Phase 6 ✅ อนุมัติแล้ว** (ผู้ใช้ยืนยัน "Phase 6 เห็นชอบแล้ว") · เรื่อง LINE Login พักไว้ก่อนตามที่ผู้ใช้สั่ง
- git repo เพิ่งถูกสร้างในวันนี้ (ก่อนหน้านี้โปรเจกต์ไม่เคยอยู่ใต้ git เลย) — commit แรกรวมทุกอย่าง 81 ไฟล์
  `.gitignore` กัน `.env*` ไว้อยู่แล้ว และเพิ่มกัน `/.agents/`, `/.claude/skills/`, `/scratchpad/` (เครื่องมือ AI ที่ vendor ไว้ 159 ไฟล์ ไม่ใช่ส่วนหนึ่งของแอป)
- **ตรวจก่อน push:** สแกนไฟล์ทั้งหมดที่จะ commit หาคีย์ (JWT / service_role / token) → ไม่พบ · ยืนยันว่าไม่มีไฟล์ `.env` ถูก commit

**ตรวจเว็บจริงหลัง deploy แล้ว:**
- หน้า login โหลดได้ ไม่มี error ใน console
- **สแกน JavaScript ทั้ง 9 ไฟล์ (560KB) + HTML ที่ส่งถึงเบราว์เซอร์ → ไม่มีคีย์ลับรั่วเลย** (ไม่มี JWT / service_role / แม้แต่ที่อยู่ Supabase)
- คนที่ยังไม่ login เปิด `/` `/board` `/my-tasks` `/dashboard` `/trash` `/admin/users` → **เด้งไป `/login` ครบทุกหน้า**
- **ผู้ใช้ทดสอบเอง: login ผ่าน · กด Back ปกติ · refresh ค้างหน้าเดิม** (ยืนยันทั้ง B1 และ Phase F1 บน production)

**⚠️ ยังไม่ได้ทำ ก่อนส่งลิงก์ให้คนอื่นใช้:** รหัสผ่านทุกบัญชียังเป็น `123456` และ URL เปิดสาธารณะแล้ว
ต้องให้ผู้ใช้เข้าหน้า `/admin/users` กด Reset Password เอง (assistant กรอกรหัสผ่านให้ไม่ได้ เป็นข้อห้ามถาวร)

---

### migration ใหม่: `0007_wall_unread_and_drop_private.sql` และ `0008_drop_dead_functions.sql`

รวม 2 เรื่องไว้ไฟล์เดียว เพราะทั้งคู่เปลี่ยนรูปแบบผลลัพธ์ของฟังก์ชัน board post ชุดเดียวกัน (8 ตัว) — แยกไฟล์จะต้อง drop/create ซ้ำสองรอบ
**ต้อง `drop function` ก่อน `create` เสมอเมื่อคอลัมน์ที่คืนเปลี่ยน** (`is_private` → `unread`) ไม่งั้นเจอ `cannot change return type of existing function` (บทเรียนเดิมจาก 0005/0006)
ฟังก์ชันใหม่: `mark_board_posts_seen(p_user_id)` · ฟังก์ชันที่เปลี่ยนพารามิเตอร์: `create_board_post` / `update_board_post` (ตัด `p_is_private` ออก)

---

### ผลการทดสอบเซสชันนี้ (ทดสอบผ่านระบบจริงทั้งหมด ไม่ใช่แค่ build ผ่าน)

| สิ่งที่ทดสอบ | ผล |
|---|---|
| `npm test` | **22/22 ผ่าน** (เพิ่ม `board-derived.test.ts` 10 ข้อ คุมเรื่องวันที่/เขตเวลา — รันซ้ำด้วย `TZ=UTC` และ `TZ=Asia/Bangkok` ได้ผลเท่ากัน) |
| `npx tsc --noEmit` | 0 error |
| `npm run build` | ผ่าน |
| `npm run lint` | 10 errors + 1 warning — **เท่าเดิมทุกตัว ไม่มีของใหม่** (ยังเป็นของเดิมใน ThemeToggle/CreateMeetingForm/TaskRow/admin) |
| Red Badge | โบ tag อยู่ 1 memo → badge = 1 · กดเข้า The Wall → **0 ทันที** · badge "งานของฉัน" 2 → 1 |
| ป้าย New | ขึ้นบนการ์ดที่ยังไม่ได้อ่าน · กลับเข้ามาใหม่ = หายไป (ตรวจจาก DOM ไม่ใช่แค่ screenshot) |
| ค่า unread แยกตามคน (ยิง RPC จริง) | เกด 2 · พี่จา 2 · โบ 0 |
| ตัวเลขท้ายแท็บ | สร้าง memo → Mine 1→2 · ลบ memo → 2→1 · ไม่ขยับตอนกดอ่าน |
| สร้าง/ตอบ/ลบ/กู้คืน/ลบถาวร memo | ผ่านครบทุกเส้นทาง (ฟังก์ชันชุดใหม่ทั้ง 8 ตัวถูกเรียกจริง) |
| Dialog New Memo | ไม่มี checkbox Private แล้ว |
| Dashboard | เหลือ Heat Map อย่างเดียว |
| มือถือ 375px | ตัวเลขท้ายแท็บไม่ล้นขอบ |
| ความปลอดภัยหลัง migration | ฟังก์ชันใน `public` ที่ `anon`/`authenticated` เรียกได้ = **0 ตัว** |

**ข้อมูลทดสอบที่สร้างระหว่างเซสชันนี้ถูกลบถาวรหมดแล้ว** — ตรวจกับฐานข้อมูลแล้วเหลือ memo 3 รายการเท่าเดิม ถังขยะว่าง
สิ่งเดียวที่เปลี่ยนในข้อมูลจริง: `seen_by` ของ memo "อย่าลืมประชุม อลอ" มีชื่อ "โบ" เพิ่มเข้าไป (เพราะทดสอบการกดเข้าหน้า The Wall ด้วยบัญชีนั้นจริง)

---

### ⚠️ กับดักเดิมที่ยังต้องระวัง (ยกมาจากฉบับก่อน ยังใช้ได้อยู่)

1. **ห้ามใส่ `useCallback` / `memo()` ด้วยมือในโปรเจกต์นี้** — lint ของ React Compiler จะขึ้น `Compilation Skipped` ทำให้แย่กว่าไม่ทำอะไร (ใช้ `useMemo` ได้ปกติ) · ถ้าจะเปิด React Compiler **ต้องถามผู้ใช้ก่อน**
2. **ห้ามลบ `case "reopened"` ใน `historyLabel()`** — ข้อมูลจริงมีบรรทัดนั้นอยู่ ไม่ใช่ dead code
3. **`drop function` ก่อนเสมอเมื่อเปลี่ยนชนิด/คอลัมน์ที่ฟังก์ชันคืน**
4. **dev server แคชโมดูลพังค้างได้** — ถ้า console ขึ้น error ที่ขัดกับไฟล์บนดิสก์ ให้ `rm -rf .next` + restart แล้วเปิด tab ใหม่
   (เซสชันนี้เจออีกรอบ: log ยังค้าง error `boardPostNotificationCount doesn't exist` ทั้งที่แก้ไฟล์ไปแล้ว — ของจริงทำงานถูกต้อง)
5. **เปลี่ยนจากชื่อเป็น id ต้องไล่ดูทุก call site ด้วยตา** อย่าเชื่อ `tsc` อย่างเดียว (string เหมือนกันจับไม่ได้)

---

### งานที่เหลือ (เรียงตามที่แนะนำ — รายละเอียดเต็มใน `FIX-INSTRUCTIONS.md`)

| ลำดับ | งาน | หมายเหตุ |
|---|---|---|
| ~~1~~ | ~~Accessibility E1–E8~~ | ✅ เสร็จแล้ว 2026-09-16 (ดูชุดที่ 6 ข้างบน) — **เหลือให้ผู้ใช้รัน Lighthouse ยืนยันเอง** |
| ~~2~~ | ~~A4 — ลบ RPC ที่ตายแล้ว~~ | ✅ เสร็จแล้ว 2026-09-16 (ดูชุดที่ 5 ข้างบน) |
| ~~3~~ | ~~Phase F1 — แยก 5 หน้าจอเป็น route จริง~~ | ✅ เสร็จแล้ว 2026-09-16 (ดูชุดที่ 7 ข้างบน) |
| 4 | **LINE Login** | ผู้ใช้วางแผนไว้แล้ว · **งาน Phase B2 (session revoke) ให้รอทำพร้อมงานนี้** |
| 5 | **Phase 6 Approval → Phase 7** | ตามลำดับเดิมใน `PLAN.md` |

**✅ B1 (cookie) ปิดแล้ว 2026-09-16** — พิสูจน์บนของจริงตอน deploy ขึ้น Vercel (https + `APP_SECURE_COOKIES=true`) ผู้ใช้ login ผ่าน ไม่วนลูป

---

### หลักการทำงานที่ผู้ใช้ย้ำ (ยังบังคับใช้ทุกข้อ)

- **รอให้พิมพ์จบก่อนแล้วค่อยเริ่ม** — เซสชันนี้ผู้ใช้สั่งว่า "รอให้พิมพ์ให้จบ และบอกให้เริ่ม ถึงจะเริ่มอ่านและตอบ จะมีหลายข้อความ"
- **ถามก่อนเมื่อไม่แน่ใจเจตนาของดีไซน์เดิม** อย่าสรุปเองว่าพฤติกรรมแปลก ๆ คือบั๊ก
- **อธิบายให้คนที่ไม่อ่านโค้ดเข้าใจได้** ไม่ใช้ศัพท์เทคนิคโดยไม่จำเป็น
- **รายงานตามจริง** รวมถึงตอนที่ตัวเองเขียนรายงานผิด
