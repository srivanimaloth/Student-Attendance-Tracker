-- Student Attendance Tracker database schema
-- Run this entire file in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(100) not null check (length(trim(full_name)) > 0),
  roll_number varchar(30) not null unique check (length(trim(roll_number)) > 0),
  course varchar(100),
  email varchar(254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status varchar(10) not null check (status in ('present', 'absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_one_record_per_student_per_day unique (student_id, attendance_date)
);

create index if not exists idx_students_full_name on public.students (full_name);
create index if not exists idx_attendance_date on public.attendance (attendance_date desc);
create index if not exists idx_attendance_student on public.attendance (student_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at before update on public.attendance
for each row execute function public.set_updated_at();

-- This project uses a server-side service-role client. Do not expose that key
-- to the browser. These tables are not meant to be queried directly by clients.
alter table public.students enable row level security;
alter table public.attendance enable row level security;

-- No anon/authenticated policies are created intentionally. Browser requests
-- go through the Express backend, which checks the admin session first.
