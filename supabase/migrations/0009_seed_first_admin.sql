-- 0009_seed_first_admin.sql
--
-- แก้ปัญหาไก่กับไข่: ฐานข้อมูลใหม่เอี่ยมไม่มีผู้ใช้เลยสักคน แต่ admin_create_user() ต้องการ p_admin_id
-- ที่เป็น admin อยู่แล้วถึงจะเรียกได้ (กันคนนอกสร้าง admin เอง) → บนฐานข้อมูลใหม่เรียกอะไรไม่ได้เลยสักตัว
--
-- ฟังก์ชันนี้สร้างบัญชี admin ตัวแรกให้ 1 ครั้ง (username คงที่ 'admin')
-- ตั้งใจไม่ฝังรหัสผ่านไว้ในไฟล์นี้ (ไฟล์นี้เข้า git ถาวร) — รับรหัสผ่านเป็นพารามิเตอร์ตอนเรียกจริงแทน
-- เรียกครั้งเดียวตอน bootstrap โปรเจกต์ใหม่เท่านั้น (ผ่าน execute_sql ตรง ๆ ไม่ใช่เป็นส่วนหนึ่งของ migration)
-- แล้วเปลี่ยนรหัสผ่านทันทีหลัง login ครั้งแรก
--
-- กัน seed ซ้ำ: ถ้ามี admin อยู่แล้ว (ไม่ว่าโปรเจกต์เดิมหรือใหม่) จะ raise exception ไม่ทับของเดิม

create or replace function public.seed_first_admin(p_password text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if exists (select 1 from public.users where 'admin' = any(roles)) then
    raise exception 'admin_already_exists';
  end if;

  if p_password is null or length(p_password) < 6 then
    raise exception 'password_too_short';
  end if;

  insert into public.users (username, password_hash, display_name, roles, sort_order)
  values ('admin', crypt(p_password, gen_salt('bf')), 'Admin', array['admin']::user_role[], 1);
end;
$function$;

revoke execute on function public.seed_first_admin(text) from anon, authenticated, public;
grant execute on function public.seed_first_admin(text) to service_role;
