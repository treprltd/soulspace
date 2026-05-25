-- Soul Space — Auto-sync auth.users → public.users
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM: public.users is NOT automatically populated when a user signs up
-- via Supabase Auth. Without a row in public.users, sessions cannot be created
-- (FK constraint: sessions.user_id → users.id) and admin panel shows 0 users.
--
-- FIX:
--   1. Trigger function: fires AFTER INSERT on auth.users, creates the
--      corresponding public.users row.
--   2. Trigger: wires the function to auth.users.
--   3. Backfill: idempotent insert for any existing auth.users who pre-date
--      this migration (covers the 5 existing production users).
--
-- Safe to run multiple times on dev, qa, and production.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Trigger function ───────────────────────────────────────────────────────
-- security definer + search_path = public ensures the function can write to
-- public.users even though it fires in the context of auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 2. Trigger ────────────────────────────────────────────────────────────────
-- drop first for idempotency (CREATE OR REPLACE TRIGGER is PG14+; Supabase
-- may run earlier PG versions, so we use the portable drop-then-create pattern)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ── 3. Backfill existing auth users ──────────────────────────────────────────
-- Inserts a public.users row for every auth.users row that doesn't already
-- have one (on conflict = ignore). This covers all users who signed up before
-- this migration was applied.
insert into public.users (id, email, created_at)
select id, email, created_at
from auth.users
on conflict (id) do nothing;
