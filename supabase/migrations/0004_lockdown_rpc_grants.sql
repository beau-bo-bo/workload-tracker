-- 0004_lockdown_rpc_grants.sql  (แก้ปัญหาข้อ 1 ในรายงาน: ประตูหลังเปิดให้คนนอกเรียกคำสั่งได้)
--
-- ปัญหา: ฟังก์ชันทั้ง 42 ตัวเป็น SECURITY DEFINER และให้สิทธิ์ EXECUTE กับ role `anon`
--        ประกอบกับ anon key ถูกฝังอยู่ใน JavaScript ที่ส่งให้เบราว์เซอร์ทุกคน (NEXT_PUBLIC_*)
--        และฟังก์ชันเชื่อตัวตนจากพารามิเตอร์ (p_admin_id / p_user_id) โดยไม่ตรวจสอบ
--        → ใครก็ได้ยิงเข้า /rest/v1/rpc/... ตรง ๆ โดยไม่ต้อง login แล้วสวมเป็น admin ได้
--
-- วิธีแก้: ตัดสิทธิ์ทั้งหมด เหลือเฉพาะ service_role ซึ่งใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์เท่านั้น
--        ทุกคำสั่งจึงต้องผ่าน Server Action ของแอป ซึ่งอ่านตัวตนจากคุกกี้ที่เซ็นด้วย SESSION_SECRET
--        → p_user_id ไม่ใช่สิ่งที่ผู้ใช้ปลอมได้อีกต่อไป
--
-- ⚠️ ต้องรันไฟล์นี้ "หลังจาก" เว็บเปลี่ยนไปใช้ SUPABASE_SERVICE_ROLE_KEY แล้วเท่านั้น
--    ถ้ารันก่อน เว็บจะใช้งานไม่ได้ทันที
--
-- วิธีย้อนกลับ (ถ้าจำเป็นจริง ๆ — ไม่แนะนำ เพราะจะเปิดช่องโหว่กลับมา):
--   grant execute on all functions in schema public to anon, authenticated;

-- ลบเวอร์ชันเก่าที่ไม่รับ p_user_id ทิ้ง (ถูกแทนที่ด้วยเวอร์ชันใหม่ใน 0003 แล้ว)
drop function if exists public.list_deleted_board_posts();

-- ถอน EXECUTE จากทุกฟังก์ชันใน schema public
revoke execute on all functions in schema public from anon, authenticated, public;

-- กันฟังก์ชันที่จะสร้างใหม่ในอนาคตไม่ให้ได้สิทธิ์อัตโนมัติอีก
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- ให้สิทธิ์เฉพาะ service_role (คีย์นี้อยู่ฝั่งเซิร์ฟเวอร์ ไม่หลุดถึงเบราว์เซอร์)
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;
