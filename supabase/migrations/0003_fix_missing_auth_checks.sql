-- 0003_fix_missing_auth_checks.sql  (แก้ปัญหาข้อ 2 ในรายงาน: บันทึกส่วนตัวในถังขยะรั่ว)
--
-- ปัญหา: list_deleted_board_posts() เดิมไม่รับพารามิเตอร์ใด ๆ และไม่กรองอะไรเลย
--        → โพสต์ที่ตั้ง Private ถูกส่งไปถึงเครื่องของทุกคนที่เปิดเว็บ (แม้ไม่ใช่ admin)
--        ต่างจาก list_board_posts ที่กรอง private ไว้ถูกต้องอยู่แล้ว
--
-- วิธีแก้: สร้างเวอร์ชันใหม่ที่รับ p_user_id (คนละ arity กับของเดิม จึงอยู่ร่วมกันได้ชั่วคราว)
--        ของเดิมจะถูกลบใน 0004 หลังโค้ดฝั่งเว็บเปลี่ยนมาเรียกตัวใหม่เรียบร้อยแล้ว

create or replace function public.list_deleted_board_posts(p_user_id uuid)
returns table(
  id uuid, author_id uuid, author_name text, body text, reminder_date date,
  is_private boolean, tagged_user_ids uuid[], tagged_names text[],
  comments jsonb, version integer, created_at timestamp with time zone
)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name)
            from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.is_deleted = true
    -- หน้าถังขยะเปิดให้เฉพาะ admin อยู่แล้วในฝั่งเว็บ — ย้ำกฎเดียวกันที่ฐานข้อมูลด้วย
    and exists (select 1 from public.users a where a.id = p_user_id and 'admin' = any(a.roles))
    -- และถึงเป็น admin ก็ยังไม่เห็นบันทึกส่วนตัวของคนอื่น (กฎเดียวกับ list_board_posts)
    and (bp.is_private = false or bp.author_id = p_user_id or p_user_id = any(bp.tagged_user_ids))
  order by bp.created_at desc;
$function$;


-- ── set_own_avatar: เดิมไม่มีการตรวจสอบตัวตนเลยแม้แต่บรรทัดเดียว ──────────────
-- ชื่อฟังก์ชันบอกว่า "own" แต่ไม่มีอะไรบังคับว่าต้องเป็นของตัวเอง
-- (ของเดิมเก็บไว้ดูได้ที่ 0002_baseline_functions.sql)

create or replace function public.set_own_avatar(p_user_id uuid, p_avatar_variant integer)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'unauthorized';
  end if;

  if p_avatar_variant is not null and (p_avatar_variant < 0 or p_avatar_variant > 9) then
    raise exception 'invalid_avatar_variant';
  end if;

  update public.users
  set avatar_variant = p_avatar_variant
  where id = p_user_id;
end;
$function$;
