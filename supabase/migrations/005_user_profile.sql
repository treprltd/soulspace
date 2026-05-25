-- Soul Space — User profile fields for communication & identity
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for production.

-- ── Add profile columns to users table ───────────────────────────────────────
alter table users
  add column if not exists first_name      text,
  add column if not exists last_name       text,
  add column if not exists dob             date,
  add column if not exists phone           text,
  add column if not exists profile_complete boolean not null default false;

-- Phone uniqueness: only enforced when phone is provided (not null)
-- Existing users without a phone are unaffected.
create unique index if not exists users_phone_unique
  on users(phone)
  where phone is not null;
