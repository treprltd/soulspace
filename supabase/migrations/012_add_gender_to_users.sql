-- Soul Space — Add gender field to user profiles
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for each environment (Dev, QA, Prod).

-- ── Add gender column ─────────────────────────────────────────────────────────
-- Values: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
-- Optional at DB level (null = not yet provided); required by the profile form.
alter table users
  add column if not exists gender text
    check (gender in ('male', 'female', 'non_binary', 'prefer_not_to_say'));

-- ── Index for admin gender-filter queries ─────────────────────────────────────
create index if not exists users_gender_idx on users(gender)
  where gender is not null;
