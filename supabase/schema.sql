  -- FINTRACE initial Supabase schema
  -- Run this once in the Supabase SQL Editor, then add the matching VITE_* values
  -- to .env.local and Vercel. This script is intentionally safe to re-run.

  create extension if not exists pgcrypto;

  -- Keep trigger helpers out of the exposed public schema. No client role gets
  -- access to this schema; the database owner executes the auth trigger.
  create schema if not exists private;
  revoke all on schema private from public, anon, authenticated;

  create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null default 'Analyst' check (char_length(display_name) between 1 and 80),
    organization_name text check (organization_name is null or char_length(organization_name) <= 120),
    avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
  );

  create table if not exists public.investigations (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    title text not null check (char_length(title) between 1 and 180),
    source_label text not null check (char_length(source_label) between 1 and 180),
    source_kind text not null check (source_kind in ('synthetic', 'uploaded')),
    selected_account_id text not null check (selected_account_id ~ '^[A-Za-z0-9_-]{1,40}$'),
    cutoff_ms bigint,
    score smallint not null check (score in (30, 70, 100)),
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
  );

  create index if not exists investigations_owner_updated_idx
    on public.investigations (owner_id, updated_at desc);

  create or replace function private.touch_updated_at()
  returns trigger
  language plpgsql
  set search_path = public
  as $$
  begin
    new.updated_at = timezone('utc', now());
    return new;
  end;
  $$;

  create or replace function private.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    insert into public.profiles (id, display_name)
    values (
      new.id,
      left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Analyst'), 80)
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

  revoke all on function private.touch_updated_at() from public, anon, authenticated;
  revoke all on function private.handle_new_user() from public, anon, authenticated;

  drop trigger if exists profiles_touch_updated_at on public.profiles;
  create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

  drop trigger if exists investigations_touch_updated_at on public.investigations;
  create trigger investigations_touch_updated_at
  before update on public.investigations
  for each row execute function private.touch_updated_at();

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

  alter table public.profiles enable row level security;
  alter table public.investigations enable row level security;

  revoke all on table public.profiles from anon, authenticated;
  grant select, update on table public.profiles to authenticated;

  revoke all on table public.investigations from anon, authenticated;
  grant select, insert, update, delete on table public.investigations to authenticated;

  drop policy if exists "Users can read their own profile" on public.profiles;
  create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id);

  drop policy if exists "Users can update their own profile" on public.profiles;
  create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = id);

  drop policy if exists "Users can read their own investigations" on public.investigations;
  create policy "Users can read their own investigations"
  on public.investigations for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

  drop policy if exists "Users can create their own investigations" on public.investigations;
  create policy "Users can create their own investigations"
  on public.investigations for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

  drop policy if exists "Users can update their own investigations" on public.investigations;
  create policy "Users can update their own investigations"
  on public.investigations for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

  drop policy if exists "Users can delete their own investigations" on public.investigations;
  create policy "Users can delete their own investigations"
  on public.investigations for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

