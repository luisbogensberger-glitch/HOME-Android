create extension if not exists pgcrypto;

create table if not exists public.home_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '',
  status text not null default 'open' check (status in ('open','done','archived')),
  due_at timestamptz,
  area text not null default 'Personal',
  priority integer not null default 1 check (priority between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_tasks_user_status_idx on public.home_tasks(user_id, status, updated_at desc);
create index if not exists home_tasks_user_due_idx on public.home_tasks(user_id, due_at) where due_at is not null;

create table if not exists public.home_learning_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 220),
  topic text not null default '',
  content jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_learning_cards_user_status_idx on public.home_learning_cards(user_id, status, updated_at desc);

create table if not exists public.home_learning_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references public.home_learning_cards(id) on delete set null,
  reflection text not null check (char_length(reflection) between 1 and 4000),
  feedback jsonb not null default '{}'::jsonb,
  overall_score integer check (overall_score is null or overall_score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists home_learning_attempts_user_created_idx on public.home_learning_attempts(user_id, created_at desc);

create table if not exists public.home_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 80),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists home_activity_user_created_idx on public.home_activity(user_id, created_at desc);

create or replace function public.home_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists home_profiles_touch_updated_at on public.home_profiles;
create trigger home_profiles_touch_updated_at
before update on public.home_profiles
for each row execute function public.home_touch_updated_at();

drop trigger if exists home_tasks_touch_updated_at on public.home_tasks;
create trigger home_tasks_touch_updated_at
before update on public.home_tasks
for each row execute function public.home_touch_updated_at();

drop trigger if exists home_learning_cards_touch_updated_at on public.home_learning_cards;
create trigger home_learning_cards_touch_updated_at
before update on public.home_learning_cards
for each row execute function public.home_touch_updated_at();

alter table public.home_profiles enable row level security;
alter table public.home_tasks enable row level security;
alter table public.home_learning_cards enable row level security;
alter table public.home_learning_attempts enable row level security;
alter table public.home_activity enable row level security;

drop policy if exists home_profiles_owner_all on public.home_profiles;
create policy home_profiles_owner_all on public.home_profiles
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists home_tasks_owner_all on public.home_tasks;
create policy home_tasks_owner_all on public.home_tasks
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists home_learning_cards_owner_all on public.home_learning_cards;
create policy home_learning_cards_owner_all on public.home_learning_cards
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists home_learning_attempts_owner_all on public.home_learning_attempts;
create policy home_learning_attempts_owner_all on public.home_learning_attempts
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists home_activity_owner_all on public.home_activity;
create policy home_activity_owner_all on public.home_activity
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.home_profiles to authenticated;
grant select, insert, update, delete on public.home_tasks to authenticated;
grant select, insert, update, delete on public.home_learning_cards to authenticated;
grant select, insert, update, delete on public.home_learning_attempts to authenticated;
grant select, insert, update, delete on public.home_activity to authenticated;
