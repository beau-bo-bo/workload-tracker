-- 0001_baseline_schema.sql
-- สำเนาโครงสร้างฐานข้อมูลตามที่มีอยู่จริงบน project kalooxclwbnjunuxbjst ณ 2026-09-15
-- ไฟล์นี้คือ "จุดตั้งต้น" ไม่ใช่ของใหม่ — สร้างขึ้นเพื่อให้มีสำเนาไว้ใน git ก่อนเริ่มแก้ไขใด ๆ
-- (ก่อนหน้านี้คำสั่งฐานข้อมูลทั้งหมดมีอยู่แค่บนระบบจริงที่เดียว ย้อนกลับไม่ได้ถ้าแก้ผิด)

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ── Enums ─────────────────────────────────────────────────────────────────────
create type public.user_role       as enum ('admin', 'owner', 'inspector');
create type public.meeting_tab     as enum ('board', 'excom');
create type public.meeting_sub_tab as enum ('resume', 'draft', 'conduct');
create type public.task_status     as enum ('blank', 'pending', 'done', 'closed');

-- ── Tables ────────────────────────────────────────────────────────────────────
create table public.users (
  id uuid not null default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  display_name text not null,
  created_at timestamp with time zone not null default now(),
  roles user_role[] not null,
  sort_order integer not null,
  review_groups text[] not null default '{}'::text[],
  can_manage_tasks boolean not null default true,
  dashboard_sort_order integer,
  avatar_variant integer,
  constraint users_pkey primary key (id),
  constraint users_username_key unique (username),
  constraint users_roles_not_empty check (array_length(roles, 1) > 0)
);

create table public.meetings (
  id uuid not null default gen_random_uuid(),
  title text not null,
  timeline text,
  tab meeting_tab not null,
  sub_tab meeting_sub_tab not null,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint meetings_pkey primary key (id)
);

create table public.tasks (
  id uuid not null default gen_random_uuid(),
  meeting_id uuid,
  title text not null,
  ecm_number text,
  owner text,
  due_date date,
  status task_status not null default 'blank'::task_status,
  inspector text,
  urgent boolean not null default false,
  note text,
  history jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  is_deleted boolean not null default false,
  deleted_from_meeting_title text,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamp with time zone not null default now(),
  excluded_auto_steps text[] not null default '{}'::text[],
  constraint tasks_pkey primary key (id),
  constraint tasks_meeting_id_fkey foreign key (meeting_id) references public.meetings(id) on delete cascade
);

create table public.board_posts (
  id uuid not null default gen_random_uuid(),
  author_id uuid not null,
  author_name text not null,
  body text not null,
  reminder_date date,
  is_private boolean not null default false,
  tagged_user_ids uuid[] not null default '{}'::uuid[],
  comments jsonb not null default '[]'::jsonb,
  is_deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamp with time zone not null default now(),
  constraint board_posts_pkey primary key (id),
  constraint board_posts_author_id_fkey foreign key (author_id) references public.users(id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index tasks_meeting_id_idx    on public.tasks    using btree (meeting_id);
create index tasks_is_deleted_idx    on public.tasks    using btree (is_deleted);
create index meetings_is_archived_idx on public.meetings using btree (is_archived);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- เปิด RLS ไว้ทุกตารางและ "ไม่มี policy" โดยตั้งใจ = ห้ามเข้าถึงตารางตรง ๆ จากภายนอกทั้งหมด
-- การเข้าถึงข้อมูลทุกทางต้องผ่านฟังก์ชันใน 0002 เท่านั้น
alter table public.users       enable row level security;
alter table public.meetings    enable row level security;
alter table public.tasks       enable row level security;
alter table public.board_posts enable row level security;
