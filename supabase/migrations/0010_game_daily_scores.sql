-- 0010_game_daily_scores.sql
-- มินิเกมมายสวีปเปอร์ซ่อนในระบบ (แตะโลโก้ "W" ที่ Header 5 ครั้งติด) + leaderboard รายวัน
--
-- ทำไมมีแค่ 1 แถวต่อ user (ไม่เก็บ history ทุกรอบที่เล่น):
--   โจทย์คือ "จบวันไม่ต้องเก็บ record เปลือง DB" จึงใช้ตารางที่ขนาด = จำนวนผู้ใช้เสมอ ไม่มีวันบวมตามเวลา
--   ทุกครั้งที่ชนะจะ upsert ทับแถวเดิมของ user คนนั้น ถ้า play_date ที่เก็บไว้ไม่ใช่วันนี้ก็เขียนทับด้วยคะแนนใหม่ทันที
--   (รีเซ็ตประจำวันแบบ lazy ไม่ต้องมี cron job มาล้างข้อมูล) ถ้าเป็นวันเดียวกันจะอัปเดตเฉพาะตอนทำเวลาได้ดีกว่าเดิม
--   leaderboard อ่านแค่แถวที่ play_date = วันนี้ แถวของเมื่อวานที่ยังไม่ถูกเขียนทับจะถูกกรองออกไปเองโดยไม่ต้องลบ

create table public.game_daily_scores (
  user_id uuid not null,
  best_seconds integer not null,
  play_date date not null,
  updated_at timestamp with time zone not null default now(),
  constraint game_daily_scores_pkey primary key (user_id),
  constraint game_daily_scores_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  constraint game_daily_scores_best_seconds_check check (best_seconds > 0 and best_seconds <= 3600)
);

create index game_daily_scores_play_date_idx on public.game_daily_scores (play_date);

alter table public.game_daily_scores enable row level security;

-- ── submit_minesweeper_score: ส่งคะแนนตอนชนะเกม (แพ้ไม่เรียกฟังก์ชันนี้) ──────
create or replace function public.submit_minesweeper_score(p_user_id uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'unauthorized';
  end if;

  if p_seconds is null or p_seconds <= 0 or p_seconds > 3600 then
    raise exception 'invalid_score';
  end if;

  insert into public.game_daily_scores (user_id, best_seconds, play_date, updated_at)
  values (p_user_id, p_seconds, current_date, now())
  on conflict (user_id) do update
  set best_seconds = case
        when public.game_daily_scores.play_date <> current_date then excluded.best_seconds
        when excluded.best_seconds < public.game_daily_scores.best_seconds then excluded.best_seconds
        else public.game_daily_scores.best_seconds
      end,
      play_date = current_date,
      updated_at = now();
end;
$function$;

-- ── list_daily_leaderboard: อันดับ 10 คนแรกของวันนี้ เรียงจากเวลาน้อยไปมาก ──
create or replace function public.list_daily_leaderboard()
returns table(display_name text, best_seconds integer)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  select u.display_name, s.best_seconds
  from public.game_daily_scores s
  join public.users u on u.id = s.user_id
  where s.play_date = current_date
  order by s.best_seconds asc
  limit 10;
$function$;

-- ฟังก์ชันใหม่ได้สิทธิ์ EXECUTE จาก PUBLIC เป็นค่าเริ่มต้นของ Postgres เสมอ ไม่ว่า 0004 จะ alter
-- default privileges ไว้แล้วหรือไม่ (ขึ้นกับ role ที่รันคำสั่งสร้างฟังก์ชัน) — ต้อง revoke ตรงนี้ซ้ำทุกครั้ง
-- ไม่งั้นซ้ำรอยช่องโหว่เดิมที่ 0004 แก้ไว้ (anon ยิง RPC ตรงได้โดยไม่ต้อง login)
revoke execute on function public.submit_minesweeper_score(uuid, integer) from anon, authenticated, public;
revoke execute on function public.list_daily_leaderboard() from anon, authenticated, public;
grant execute on function public.submit_minesweeper_score(uuid, integer) to service_role;
grant execute on function public.list_daily_leaderboard() to service_role;
