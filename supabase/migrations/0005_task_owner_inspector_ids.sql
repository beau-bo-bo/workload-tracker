-- 0005_task_owner_inspector_ids.sql  (แก้ปัญหาข้อ 5 ในรายงาน / B5)
--
-- ปัญหา: tasks.owner และ tasks.inspector เก็บเป็น "ชื่อที่แสดง" ไม่ใช่รหัสประจำตัว
--        พอ admin แก้ชื่อใครสักคน งานเก่าทั้งหมดของเขาก็ขาดจากเขาทันทีโดยไม่มีอะไรเตือน
--        (หน้า "งานของฉัน" ว่างเปล่า · Dashboard นับเป็น 0 · badge หาย)
--        และถ้ามีคนชื่อซ้ำกัน ระบบจะยุบเป็นคนเดียว
--
-- วิธีแก้: เพิ่มคอลัมน์ owner_id / inspector_id ที่อ้างถึง users(id) แล้วใช้ id เป็นตัวเชื่อมแทนชื่อ
--        ส่วนชื่อที่แสดงบนหน้าจอให้ฝั่งเว็บไปเปิดจากรายชื่อผู้ใช้เอาเอง (เปลี่ยนชื่อแล้วตามทันทีทุกที่)
--
-- ตรวจสอบก่อนย้าย: ชื่อที่ใช้อยู่ทั้งหมด 14 แบบ จับคู่กับผู้ใช้ได้ครบ 1:1 ไม่มีชื่อกำพร้า ไม่มีชื่อซ้ำ
--
-- หมายเหตุ: คอลัมน์ owner / inspector (text) เดิม ยังเก็บไว้ก่อนเป็นตัวสำรอง ไม่มีโค้ดอ่านแล้ว
--          ให้ลบทิ้งในไฟล์ถัดไปเมื่อผู้ใช้ยืนยันว่าระบบทำงานปกติดีแล้ว

alter table public.tasks
  add column owner_id uuid references public.users(id),
  add column inspector_id uuid references public.users(id);

update public.tasks t set owner_id = u.id
from public.users u where t.owner = u.display_name;

update public.tasks t set inspector_id = u.id
from public.users u where t.inspector = u.display_name;

create index tasks_owner_id_idx on public.tasks (owner_id);
create index tasks_inspector_id_idx on public.tasks (inspector_id);

-- ประวัติ (history) เก็บชื่อไว้ในแต่ละบรรทัดด้วย — เติม id เข้าไปคู่กัน
-- ชื่อเดิมยังเก็บไว้ เพราะ log ควรบอกว่า "ตอนนั้น" เรียกเขาว่าอะไร แต่การจับคู่คนใช้ id
update public.tasks t
set history = coalesce((
  select jsonb_agg(
    e.h
      || case when ou.id is not null then jsonb_build_object('ownerId', ou.id) else '{}'::jsonb end
      || case when iu.id is not null then jsonb_build_object('inspectorId', iu.id) else '{}'::jsonb end
    order by e.idx
  )
  from jsonb_array_elements(t.history) with ordinality as e(h, idx)
  left join public.users ou on ou.display_name = e.h->>'owner'
  left join public.users iu on iu.display_name = e.h->>'inspector'
), '[]'::jsonb)
where jsonb_array_length(t.history) > 0;

-- ขั้นตอนอัตโนมัติที่ผู้ใช้ลบทิ้ง เก็บเป็น key แบบ "sent:ชื่อคน" — ต้องย้ายเป็น "sent:id" ด้วย
-- ไม่งั้นขั้นตอนที่ลบไปแล้วจะโผล่กลับมาหลังย้ายระบบ
update public.tasks t
set excluded_auto_steps = coalesce((
  select array_agg(
    case when u.id is not null
      then split_part(s, ':', 1) || ':' || u.id::text
      else s
    end
  )
  from unnest(t.excluded_auto_steps) s
  left join public.users u on u.display_name = substring(s from position(':' in s) + 1)
), '{}')
where array_length(t.excluded_auto_steps, 1) > 0;


-- ── ฟังก์ชันที่ต้องเปลี่ยนมารับ id แทนชื่อ ────────────────────────────────────
-- เปลี่ยนชนิดพารามิเตอร์จึงต้อง drop ของเดิมก่อน (create or replace ใช้ไม่ได้)

drop function if exists public.create_task(uuid, uuid, text, text, text, date, boolean, text);
drop function if exists public.update_task_details(uuid, uuid, text, text, text, date, boolean, text, jsonb, integer);
drop function if exists public.update_task_details(uuid, uuid, text, text, text, date, boolean, text, jsonb, integer, text[]);
drop function if exists public.update_task_workflow(uuid, uuid, integer, task_status, text, jsonb);

create function public.create_task(
  p_user_id uuid, p_meeting_id uuid, p_title text, p_ecm_number text,
  p_owner_id uuid, p_due_date date, p_urgent boolean, p_note text
) returns tasks
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v_next_order int;
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  if p_owner_id is not null and not exists (select 1 from users u where u.id = p_owner_id) then
    raise exception 'owner_not_found';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_order
  from tasks
  where (meeting_id = p_meeting_id or (meeting_id is null and p_meeting_id is null)) and is_deleted = false;

  insert into tasks (meeting_id, title, ecm_number, owner_id, due_date, urgent, note, sort_order)
  values (p_meeting_id, trim(p_title), p_ecm_number, p_owner_id, p_due_date, coalesce(p_urgent, false), p_note, v_next_order)
  returning * into v_result;

  return v_result;
end;
$function$;

create function public.update_task_details(
  p_user_id uuid, p_id uuid, p_title text, p_ecm_number text, p_owner_id uuid,
  p_due_date date, p_urgent boolean, p_note text, p_checklist jsonb,
  p_version integer, p_excluded_auto_steps text[] default null
) returns tasks
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  if p_owner_id is not null and not exists (select 1 from users u where u.id = p_owner_id) then
    raise exception 'owner_not_found';
  end if;

  update tasks
  set title = trim(p_title), ecm_number = p_ecm_number, owner_id = p_owner_id,
      due_date = p_due_date, urgent = coalesce(p_urgent, false), note = p_note,
      checklist = coalesce(p_checklist, '[]'::jsonb),
      excluded_auto_steps = coalesce(p_excluded_auto_steps, '{}'::text[]),
      version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$;

create function public.update_task_workflow(
  p_user_id uuid, p_id uuid, p_version integer,
  p_status task_status, p_inspector_id uuid, p_history jsonb
) returns tasks
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id) then
    raise exception 'unauthorized';
  end if;

  if p_inspector_id is not null and not exists (select 1 from users u where u.id = p_inspector_id) then
    raise exception 'inspector_not_found';
  end if;

  update tasks
  set status = p_status, inspector_id = p_inspector_id,
      history = coalesce(p_history, '[]'::jsonb), version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$;


-- ── ฟังก์ชันอ่านรายการงาน: เพิ่ม owner_id / inspector_id ในผลลัพธ์ ──────────────

-- เปลี่ยนรูปแบบคอลัมน์ผลลัพธ์ จึงต้อง drop ก่อน (create or replace ใช้ไม่ได้)
drop function if exists public.list_active_tasks();
create function public.list_active_tasks()
returns table(
  id uuid, meeting_id uuid, title text, ecm_number text, owner_id uuid, due_date date,
  status task_status, inspector_id uuid, urgent boolean, note text, history jsonb,
  checklist jsonb, excluded_auto_steps text[], sort_order integer, version integer
)
language sql security definer set search_path to 'public', 'extensions' as $function$
  select t.id, t.meeting_id, t.title, t.ecm_number, t.owner_id, t.due_date,
         t.status, t.inspector_id, t.urgent, t.note, t.history, t.checklist, t.excluded_auto_steps,
         t.sort_order, t.version
  from tasks t
  where t.is_deleted = false
  order by t.sort_order asc;
$function$;

drop function if exists public.list_deleted_tasks();
create function public.list_deleted_tasks()
returns table(
  id uuid, meeting_id uuid, deleted_from_meeting_title text, title text, ecm_number text,
  owner_id uuid, due_date date, status task_status, inspector_id uuid, urgent boolean, note text,
  history jsonb, checklist jsonb, excluded_auto_steps text[], sort_order integer, version integer
)
language sql security definer set search_path to 'public', 'extensions' as $function$
  select t.id, t.meeting_id, t.deleted_from_meeting_title, t.title, t.ecm_number, t.owner_id,
         t.due_date, t.status, t.inspector_id, t.urgent, t.note, t.history,
         t.checklist, t.excluded_auto_steps, t.sort_order, t.version
  from tasks t
  where t.is_deleted = true
  order by t.sort_order asc;
$function$;

-- ฟังก์ชันใหม่ต้องให้สิทธิ์ service_role ด้วย (default privileges ถูกถอนไปแล้วใน 0004)
grant execute on all functions in schema public to service_role;
