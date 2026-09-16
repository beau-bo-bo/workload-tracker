-- 0007_wall_unread_and_drop_private.sql
--
-- ทำ 2 เรื่องพร้อมกัน เพราะทั้งคู่เปลี่ยนรูปแบบผลลัพธ์ของฟังก์ชันชุดเดียวกัน (board post ทั้ง 8 ตัว)
-- ถ้าแยกไฟล์จะต้อง drop/create ฟังก์ชันชุดเดิมซ้ำสองรอบโดยไม่จำเป็น
--
-- ── เรื่องที่ 1: เลิกใช้ Private Memo (ผู้ใช้สั่ง 2026-09-16) ─────────────────────
-- เหตุผลของผู้ใช้: memo ส่วนตัวมองไม่เห็นจากภายนอก คุมจำนวนไม่ได้ เดี๋ยวรกฐานข้อมูล
-- หลักการของ The Wall คือ "แปะสิ่งที่ต้องทำ + แจ้งข่าว" แล้วลบทิ้งเมื่อทำเสร็จ/เลยกำหนดไปแล้ว
-- ตรวจก่อนลบคอลัมน์: select count(*) from board_posts where is_private → 0 แถว
--   (ทั้งที่ยังอยู่และในถังขยะ) → ไม่มีบันทึกส่วนตัวของใครหลุดออกมาเป็นสาธารณะจากการลบคอลัมน์นี้
-- ⚠️ ลบคอลัมน์ย้อนกลับไม่ได้ ถ้าต้องกู้ต้องใช้ Point-in-Time Recovery ของ Supabase
--
-- ── เรื่องที่ 2: Red Badge ของ The Wall = "ข้อความใหม่ที่ Tag ฉันแล้วฉันยังไม่ได้เปิดดู" ──
-- เดิม badge นับ "โพสต์ที่เกี่ยวกับฉันทั้งหมด" → ไม่มีวันเป็นศูนย์ (ปัญหาข้อ 6 ใน FIX-INSTRUCTIONS.md)
-- ตอนนี้เก็บ seen_by เป็น array ของ user id บนตัวโพสต์เอง แทนการสร้างตารางใหม่:
--   - จำนวนคนในระบบมีหลักสิบ และ memo เป็นของชั่วคราวที่ต้องถูกลบอยู่แล้ว → array เล็กมาก
--   - ลบ memo = ข้อมูลการอ่านหายไปพร้อมกันเอง ไม่มีแถวกำพร้าค้างในฐานข้อมูล (ตรงกับที่ผู้ใช้กังวลว่า "เดี๋ยวรก db")
--   - array_append ใน update เดียวเป็น atomic ต่อแถว → สองเครื่องกดพร้อมกันก็ไม่ทับกัน
-- ฟังก์ชันคืนค่า unread (boolean ต่อผู้ใช้ที่เรียก) แทนที่จะคืน seen_by ทั้งก้อน
-- → เบราว์เซอร์ไม่ต้องรู้ว่าใครอ่านอะไรไปแล้วบ้าง

-- ── ขั้นที่ 1: ลบฟังก์ชันชุดเดิมทิ้งก่อน ────────────────────────────────────────
-- create or replace ใช้ไม่ได้ เพราะคอลัมน์ที่คืนเปลี่ยน (is_private → unread)
-- Postgres จะขึ้น "cannot change return type of existing function" (บทเรียนจาก 0005/0006)

drop function if exists public.add_board_comment(uuid, uuid, text, integer);
drop function if exists public.create_board_post(uuid, text, date, boolean, uuid[]);
drop function if exists public.delete_board_comment(uuid, uuid, text, integer);
drop function if exists public.delete_board_post(uuid, uuid, integer);
drop function if exists public.list_board_posts(uuid);
drop function if exists public.list_deleted_board_posts(uuid);
drop function if exists public.restore_board_post(uuid, uuid);
drop function if exists public.update_board_post(uuid, uuid, text, date, boolean, uuid[], integer);

-- ── ขั้นที่ 2: เปลี่ยนโครงตาราง ─────────────────────────────────────────────────

alter table public.board_posts drop column is_private;
alter table public.board_posts add column seen_by uuid[] not null default '{}'::uuid[];

-- ไม่ backfill seen_by ให้โพสต์เดิมโดยตั้งใจ — โพสต์ที่ค้างอยู่ตอนนี้ยังไม่มีใครเคย "เปิดดู"
-- ในความหมายใหม่ จึงถือว่ายังไม่ได้อ่านและขึ้น badge ตามปกติ

-- ── ขั้นที่ 3: สร้างฟังก์ชันชุดใหม่ (เหมือนเดิมทุกอย่าง ยกเว้น is_private → unread) ──

create or replace function public.list_board_posts(p_user_id uuid)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name)
            from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.is_deleted = false
  order by bp.created_at desc;
$function$;


create or replace function public.list_deleted_board_posts(p_user_id uuid)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name)
            from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.is_deleted = true
    -- หน้าถังขยะเปิดให้เฉพาะ admin อยู่แล้วในฝั่งเว็บ — ย้ำกฎเดียวกันที่ฐานข้อมูลด้วย (กฎเดิมจาก 0003)
    and exists (select 1 from public.users a where a.id = p_user_id and 'admin' = any(a.roles))
  order by bp.created_at desc;
$function$;


create or replace function public.create_board_post(p_user_id uuid, p_body text, p_reminder_date date, p_tagged_user_ids uuid[])
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_author_name text;
  v_post_id uuid;
begin
  select u.display_name into v_author_name from public.users u where u.id = p_user_id;
  if v_author_name is null then
    raise exception 'unauthorized';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body_required';
  end if;

  -- คนเขียนถือว่าอ่านของตัวเองแล้วเสมอ (ต่อให้ tag ตัวเองไว้ด้วยก็ไม่ต้องขึ้น badge ให้ตัวเอง)
  insert into public.board_posts (author_id, author_name, body, reminder_date, tagged_user_ids, seen_by)
  values (p_user_id, v_author_name, trim(p_body), p_reminder_date, coalesce(p_tagged_user_ids, '{}'), array[p_user_id])
  returning board_posts.id into v_post_id;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$;


create or replace function public.update_board_post(p_user_id uuid, p_id uuid, p_body text, p_reminder_date date, p_tagged_user_ids uuid[], p_version integer)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_post_id uuid;
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body_required';
  end if;

  update public.board_posts bp
  set body = trim(p_body),
      reminder_date = p_reminder_date,
      tagged_user_ids = coalesce(p_tagged_user_ids, '{}'),
      version = bp.version + 1
  where bp.id = p_id and bp.version = p_version and bp.author_id = p_user_id and bp.is_deleted = false
  returning bp.id into v_post_id;

  if v_post_id is null then
    if exists (select 1 from public.board_posts bp where bp.id = p_id and bp.author_id != p_user_id) then
      raise exception 'unauthorized';
    end if;
    raise exception 'version_conflict';
  end if;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$;


create or replace function public.add_board_comment(p_user_id uuid, p_post_id uuid, p_body text, p_version integer)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_author_name text;
  v_comment jsonb;
  v_post_id uuid;
begin
  select u.display_name into v_author_name from public.users u where u.id = p_user_id;
  if v_author_name is null then
    raise exception 'unauthorized';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body_required';
  end if;

  v_comment := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'authorId', p_user_id::text,
    'authorName', v_author_name,
    'body', trim(p_body),
    'at', now()
  );

  update public.board_posts bp
  set comments = bp.comments || jsonb_build_array(v_comment),
      version = bp.version + 1
  where bp.id = p_post_id and bp.version = p_version and bp.is_deleted = false
  returning bp.id into v_post_id;

  if v_post_id is null then
    raise exception 'version_conflict';
  end if;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$;


create or replace function public.delete_board_comment(p_user_id uuid, p_post_id uuid, p_comment_id text, p_version integer)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_comment_author uuid;
  v_post_id uuid;
begin
  select (c->>'authorId')::uuid into v_comment_author
  from public.board_posts bp, jsonb_array_elements(bp.comments) c
  where bp.id = p_post_id and c->>'id' = p_comment_id;

  if v_comment_author is null then
    raise exception 'not_found';
  end if;

  if v_comment_author != p_user_id
     and not exists (select 1 from public.users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  update public.board_posts bp
  set comments = coalesce((
        select jsonb_agg(c) from jsonb_array_elements(bp.comments) c where c->>'id' != p_comment_id
      ), '[]'::jsonb),
      version = bp.version + 1
  where bp.id = p_post_id and bp.version = p_version
  returning bp.id into v_post_id;

  if v_post_id is null then
    raise exception 'version_conflict';
  end if;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$;


create or replace function public.delete_board_post(p_user_id uuid, p_id uuid, p_version integer)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_post_id uuid;
begin
  if not exists (
    select 1 from public.board_posts bp
    where bp.id = p_id
      and (bp.author_id = p_user_id or exists (
        select 1 from public.users u where u.id = p_user_id and u.can_manage_tasks = true
      ))
  ) then
    raise exception 'unauthorized';
  end if;

  update public.board_posts bp
  set is_deleted = true, version = bp.version + 1
  where bp.id = p_id and bp.version = p_version
  returning bp.id into v_post_id;

  if v_post_id is null then
    raise exception 'version_conflict';
  end if;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$;


create or replace function public.restore_board_post(p_user_id uuid, p_id uuid)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  unread boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_post_id uuid;
begin
  if not exists (select 1 from public.users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  update public.board_posts bp
  set is_deleted = false, version = bp.version + 1
  where bp.id = p_id
  returning bp.id into v_post_id;

  if v_post_id is null then
    raise exception 'not_found';
  end if;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         (p_user_id = any(bp.tagged_user_ids) and not (p_user_id = any(bp.seen_by))),
         bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$;


-- ── ขั้นที่ 4: ฟังก์ชันใหม่ — บันทึกว่าผู้ใช้เปิดดู The Wall แล้ว ──────────────────
--
-- เรียกครั้งเดียวตอนกดเข้าหน้า The Wall แล้วทำเครื่องหมายทุกโพสต์ที่ tag ฉันไว้ว่า "อ่านแล้ว"
--
-- ⚠️ ตั้งใจไม่บวก version — การอ่านไม่ใช่การแก้ไขเนื้อหา
--    ถ้าบวก version คนที่กำลังเปิด dialog แก้ memo ค้างไว้จะโดน version_conflict เพราะคนอื่นแค่เปิดดู
create or replace function public.mark_board_posts_seen(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_count integer;
begin
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'unauthorized';
  end if;

  update public.board_posts bp
  set seen_by = array_append(bp.seen_by, p_user_id)
  where bp.is_deleted = false
    and p_user_id = any(bp.tagged_user_ids)
    and not (p_user_id = any(bp.seen_by));

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;


-- ── ขั้นที่ 5: สิทธิ์ ────────────────────────────────────────────────────────────
-- alter default privileges จาก 0004 ครอบฟังก์ชันที่สร้างใหม่อยู่แล้ว แต่ย้ำอีกครั้งให้ชัดเจน
-- (ฟังก์ชันที่ถูก drop แล้ว create ใหม่ = ฟังก์ชันคนละตัวในสายตา Postgres)

revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on all functions in schema public to service_role;
