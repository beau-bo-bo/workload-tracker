-- 0008_drop_dead_functions.sql  (งาน A4 ใน FIX-INSTRUCTIONS.md — แก้ B11/C15)
--
-- ลบฟังก์ชันที่ "ถูกแทนที่ไปแล้วแต่ยังค้างอยู่ในฐานข้อมูล" ทิ้ง
-- ของพวกนี้อันตรายกว่าที่คิด เพราะเป็น SECURITY DEFINER ที่ยังทำงานได้จริงทุกตัว
-- ถ้าวันหนึ่งสิทธิ์ถูกเปิดพลาด หรือมีคนเผลอเรียกใช้ของเก่า จะได้พฤติกรรมคนละแบบกับระบบปัจจุบันเงียบ ๆ
-- (เช่น admin_update_roles เปลี่ยน role ได้โดยไม่แตะ review_groups/can_manage_tasks ซึ่งไม่ตรงกับ UI ปัจจุบันแล้ว)
--
-- ตรวจก่อนลบครบทั้ง 3 ข้อ (2026-09-16):
--   1. grep ทั้ง src/ — ไม่มีโค้ดฝั่งเว็บเรียกสักตัว (0 ครั้งทั้ง 4 ชื่อ)
--   2. ไล่ pg_get_functiondef ของทุกฟังก์ชันใน schema public — ไม่มีฟังก์ชันไหนเรียกถึงกันเอง
--   3. ไม่มี trigger ใน schema public เลย (trigger ที่มีอยู่เป็นของ storage/realtime ซึ่งไม่เกี่ยวข้อง)
--
-- ตัวที่มาแทน (ยังใช้งานอยู่ตามปกติ):
--   admin_rename_user  + admin_update_roles → admin_update_user  (แก้ชื่อ + role + review_groups + can_manage_tasks ในครั้งเดียว)
--   admin_reorder_user (สลับทีละคู่)        → admin_set_user_order (จัดลำดับทั้งชุดแบบ batch ตาม Drag and Drop)
--   update_meeting                          → update_meeting_details (ตัวใหม่มีการตรวจ version กันแก้ชนกัน)
--
-- วิธีย้อนกลับถ้าจำเป็น: โค้ดเต็มของทั้ง 4 ตัวยังอยู่ใน 0002_baseline_functions.sql (สำเนาจุดตั้งต้น) ก๊อปกลับมาได้

drop function if exists public.admin_rename_user(uuid, uuid, text);
drop function if exists public.admin_reorder_user(uuid, uuid, text);
drop function if exists public.admin_update_roles(uuid, uuid, user_role[]);
drop function if exists public.update_meeting(uuid, uuid, text, text, integer);
