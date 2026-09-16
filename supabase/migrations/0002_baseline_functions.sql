-- 0002_baseline_functions.sql
-- สำเนาฟังก์ชันทั้ง 42 ตัวตามที่มีอยู่จริงบน project kalooxclwbnjunuxbjst ณ 2026-09-15
-- คัดลอกมาตรง ๆ ยังไม่แก้ไขอะไรทั้งสิ้น เพื่อใช้เป็นจุดย้อนกลับ
-- การแก้ไขจริงอยู่ในไฟล์ 0003 เป็นต้นไป

CREATE OR REPLACE FUNCTION public.add_board_comment(p_user_id uuid, p_post_id uuid, p_body text, p_version integer)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_admin_id uuid, p_username text, p_password text, p_display_name text, p_roles user_role[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_next_order int;
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'roles_required';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_order from users;

  insert into users (username, password_hash, display_name, roles, sort_order)
  values (p_username, crypt(p_password, gen_salt('bf')), p_display_name, p_roles, v_next_order);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_admin_id uuid, p_target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  if p_admin_id = p_target_user_id then
    raise exception 'cannot_delete_self';
  end if;

  delete from users where id = p_target_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_admin_id uuid)
 RETURNS TABLE(id uuid, username text, display_name text, roles user_role[], created_at timestamp with time zone, sort_order integer, review_groups text[], can_manage_tasks boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  return query
  select u.id, u.username, u.display_name, u.roles, u.created_at, u.sort_order, u.review_groups, u.can_manage_tasks
  from users u
  order by u.sort_order asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_rename_user(p_admin_id uuid, p_target_user_id uuid, p_display_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'display_name_required';
  end if;

  update users
  set display_name = trim(p_display_name)
  where id = p_target_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_reorder_user(p_admin_id uuid, p_user_id uuid, p_direction text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_current_order int;
  v_neighbor_id uuid;
  v_neighbor_order int;
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'invalid_direction';
  end if;

  select sort_order into v_current_order from users where id = p_user_id;
  if v_current_order is null then
    raise exception 'user_not_found';
  end if;

  if p_direction = 'up' then
    select id, sort_order into v_neighbor_id, v_neighbor_order
    from users where sort_order < v_current_order order by sort_order desc limit 1;
  else
    select id, sort_order into v_neighbor_id, v_neighbor_order
    from users where sort_order > v_current_order order by sort_order asc limit 1;
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update users set sort_order = v_neighbor_order where id = p_user_id;
  update users set sort_order = v_current_order where id = v_neighbor_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_admin_id uuid, p_target_user_id uuid, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_target_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_dashboard_order(p_admin_id uuid, p_user_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_id uuid;
  v_idx int := 0;
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  foreach v_id in array p_user_ids loop
    v_idx := v_idx + 1;
    update users set dashboard_sort_order = v_idx where id = v_id;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_user_order(p_admin_id uuid, p_user_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_id uuid;
  v_idx int := 0;
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  foreach v_id in array p_user_ids loop
    v_idx := v_idx + 1;
    update users set sort_order = v_idx where id = v_id;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_roles(p_admin_id uuid, p_target_user_id uuid, p_roles user_role[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'roles_required';
  end if;

  update users
  set roles = p_roles
  where id = p_target_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_user(p_admin_id uuid, p_target_user_id uuid, p_display_name text, p_roles user_role[], p_review_groups text[] DEFAULT '{}'::text[], p_can_manage_tasks boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
    raise exception 'unauthorized';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'display_name_required';
  end if;

  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'roles_required';
  end if;

  update users
  set display_name = trim(p_display_name),
      roles = p_roles,
      review_groups = coalesce(p_review_groups, '{}'),
      can_manage_tasks = coalesce(p_can_manage_tasks, true)
  where id = p_target_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_meeting(p_user_id uuid, p_id uuid, p_version integer)
 RETURNS meetings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result meetings;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  update meetings
  set is_archived = true, version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.change_own_password(p_user_id uuid, p_current_password text, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash text;
begin
  select password_hash into v_hash from users where id = p_user_id;

  if v_hash is null or v_hash <> crypt(p_current_password, v_hash) then
    raise exception 'invalid_current_password';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_board_post(p_user_id uuid, p_body text, p_reminder_date date, p_is_private boolean, p_tagged_user_ids uuid[])
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  insert into public.board_posts (author_id, author_name, body, reminder_date, is_private, tagged_user_ids)
  values (p_user_id, v_author_name, trim(p_body), p_reminder_date, coalesce(p_is_private, false), coalesce(p_tagged_user_ids, '{}'))
  returning board_posts.id into v_post_id;

  return query
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_meeting(p_user_id uuid, p_title text, p_timeline text, p_tab meeting_tab, p_sub_tab meeting_sub_tab)
 RETURNS meetings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_next_order int;
  v_result meetings;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  select coalesce(min(sort_order), 0) - 1 into v_next_order from meetings;

  insert into meetings (title, timeline, tab, sub_tab, sort_order)
  values (trim(p_title), p_timeline, p_tab, p_sub_tab, v_next_order)
  returning * into v_result;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_task(p_user_id uuid, p_meeting_id uuid, p_title text, p_ecm_number text, p_owner text, p_due_date date, p_urgent boolean, p_note text)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  select coalesce(max(sort_order), 0) + 1 into v_next_order
  from tasks
  where (meeting_id = p_meeting_id or (meeting_id is null and p_meeting_id is null)) and is_deleted = false;

  insert into tasks (meeting_id, title, ecm_number, owner, due_date, urgent, note, sort_order)
  values (p_meeting_id, trim(p_title), p_ecm_number, nullif(trim(coalesce(p_owner, '')), ''), p_due_date, coalesce(p_urgent, false), p_note, v_next_order)
  returning * into v_result;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_board_comment(p_user_id uuid, p_post_id uuid, p_comment_id text, p_version integer)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_board_post(p_user_id uuid, p_id uuid, p_version integer)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_board_post_forever(p_user_id uuid, p_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from public.users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  delete from public.board_posts where id = p_id and version = p_version;

  if not found then
    raise exception 'version_conflict';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_meeting_forever(p_user_id uuid, p_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  delete from meetings where id = p_id and version = p_version;

  if not found then
    raise exception 'version_conflict';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_task(p_user_id uuid, p_id uuid, p_version integer)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result tasks;
  v_meeting_title text;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  select m.title into v_meeting_title from tasks t join meetings m on m.id = t.meeting_id where t.id = p_id;

  update tasks
  set is_deleted = true,
      deleted_from_meeting_title = coalesce(v_meeting_title, 'อื่น ๆ'),
      version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_task_forever(p_user_id uuid, p_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  delete from tasks where id = p_id and version = p_version;

  if not found then
    raise exception 'version_conflict';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_own_permissions(p_user_id uuid)
 RETURNS TABLE(can_manage_tasks boolean, avatar_variant integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select u.can_manage_tasks, u.avatar_variant from users u where u.id = p_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.list_active_tasks()
 RETURNS TABLE(id uuid, meeting_id uuid, title text, ecm_number text, owner text, due_date date, status task_status, inspector text, urgent boolean, note text, history jsonb, checklist jsonb, excluded_auto_steps text[], sort_order integer, version integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select t.id, t.meeting_id, t.title, t.ecm_number, t.owner, t.due_date,
         t.status, t.inspector, t.urgent, t.note, t.history, t.checklist, t.excluded_auto_steps,
         t.sort_order, t.version
  from tasks t
  where t.is_deleted = false
  order by t.sort_order asc;
$function$
;

CREATE OR REPLACE FUNCTION public.list_all_users()
 RETURNS TABLE(id uuid, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  return query
  select u.id, u.display_name
  from public.users u
  order by u.sort_order asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_board_posts(p_user_id uuid)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.is_deleted = false
    and (bp.is_private = false or bp.author_id = p_user_id or p_user_id = any(bp.tagged_user_ids))
  order by bp.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.list_deleted_board_posts()
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.is_deleted = true
  order by bp.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.list_deleted_tasks()
 RETURNS TABLE(id uuid, meeting_id uuid, deleted_from_meeting_title text, title text, ecm_number text, owner text, due_date date, status task_status, inspector text, urgent boolean, note text, history jsonb, checklist jsonb, excluded_auto_steps text[], sort_order integer, version integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select t.id, t.meeting_id, t.deleted_from_meeting_title, t.title, t.ecm_number, t.owner,
         t.due_date, t.status, t.inspector, t.urgent, t.note, t.history,
         t.checklist, t.excluded_auto_steps, t.sort_order, t.version
  from tasks t
  where t.is_deleted = true
  order by t.sort_order asc;
$function$
;

CREATE OR REPLACE FUNCTION public.list_meetings()
 RETURNS TABLE(id uuid, title text, timeline text, tab meeting_tab, sub_tab meeting_sub_tab, is_archived boolean, sort_order integer, version integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select m.id, m.title, m.timeline, m.tab, m.sub_tab, m.is_archived, m.sort_order, m.version
  from meetings m
  order by m.sort_order asc;
$function$
;

CREATE OR REPLACE FUNCTION public.list_users_by_role(p_role user_role)
 RETURNS TABLE(id uuid, display_name text, review_groups text[], can_manage_tasks boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  return query
  select u.id, u.display_name, u.review_groups, u.can_manage_tasks
  from users u
  where p_role = any(u.roles)
  order by u.sort_order asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_workload_people()
 RETURNS TABLE(id uuid, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  return query
  select u.id, u.display_name
  from users u
  where 'owner' = any(u.roles) or 'inspector' = any(u.roles)
  order by u.dashboard_sort_order asc nulls last, u.display_name asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.login(p_username text, p_password text)
 RETURNS TABLE(id uuid, username text, display_name text, roles user_role[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  return query
  select u.id, u.username, u.display_name, u.roles
  from users u
  where u.username = p_username
    and u.password_hash = crypt(p_password, u.password_hash);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_board_post(p_user_id uuid, p_id uuid)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_meeting(p_user_id uuid, p_id uuid)
 RETURNS meetings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result meetings;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  update meetings
  set is_archived = false, version = version + 1
  where id = p_id
  returning * into v_result;

  if v_result is null then
    raise exception 'not_found';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_task(p_user_id uuid, p_id uuid)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  update tasks
  set is_deleted = false, version = version + 1
  where id = p_id
  returning * into v_result;

  if v_result is null then
    raise exception 'not_found';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_own_avatar(p_user_id uuid, p_avatar_variant integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if p_avatar_variant is not null and (p_avatar_variant < 0 or p_avatar_variant > 9) then
    raise exception 'invalid_avatar_variant';
  end if;

  update users
  set avatar_variant = p_avatar_variant
  where id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_board_post(p_user_id uuid, p_id uuid, p_body text, p_reminder_date date, p_is_private boolean, p_tagged_user_ids uuid[], p_version integer)
 RETURNS TABLE(id uuid, author_id uuid, author_name text, body text, reminder_date date, is_private boolean, tagged_user_ids uuid[], tagged_names text[], comments jsonb, version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_post_id uuid;
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body_required';
  end if;

  update public.board_posts bp
  set body = trim(p_body),
      reminder_date = p_reminder_date,
      is_private = coalesce(p_is_private, false),
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
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name) from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.id = v_post_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_meeting(p_user_id uuid, p_id uuid, p_title text, p_timeline text, p_version integer)
 RETURNS meetings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result meetings;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  update meetings
  set title = trim(p_title), timeline = p_timeline, version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_meeting_details(p_user_id uuid, p_id uuid, p_version integer, p_title text, p_timeline text)
 RETURNS meetings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result meetings;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  update meetings
  set title = p_title, timeline = p_timeline, version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_task_details(p_user_id uuid, p_id uuid, p_title text, p_ecm_number text, p_owner text, p_due_date date, p_urgent boolean, p_note text, p_checklist jsonb, p_version integer)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  update tasks
  set title = trim(p_title), ecm_number = p_ecm_number, owner = nullif(trim(coalesce(p_owner, '')), ''),
      due_date = p_due_date, urgent = coalesce(p_urgent, false), note = p_note,
      checklist = coalesce(p_checklist, '[]'::jsonb), version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_task_details(p_user_id uuid, p_id uuid, p_title text, p_ecm_number text, p_owner text, p_due_date date, p_urgent boolean, p_note text, p_checklist jsonb, p_version integer, p_excluded_auto_steps text[] DEFAULT NULL::text[])
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.can_manage_tasks = true) then
    raise exception 'unauthorized';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  update tasks
  set title = trim(p_title), ecm_number = p_ecm_number, owner = nullif(trim(coalesce(p_owner, '')), ''),
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_task_workflow(p_user_id uuid, p_id uuid, p_version integer, p_status task_status, p_inspector text, p_history jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result tasks;
begin
  if not exists (select 1 from users u where u.id = p_user_id) then
    raise exception 'unauthorized';
  end if;

  update tasks
  set status = p_status, inspector = p_inspector, history = coalesce(p_history, '[]'::jsonb), version = version + 1
  where id = p_id and version = p_version
  returning * into v_result;

  if v_result is null then
    raise exception 'version_conflict';
  end if;

  return v_result;
end;
$function$
;
