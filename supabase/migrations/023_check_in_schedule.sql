-- Migration 023: Richer check-in schedule (user-chosen cadence)
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for each environment (Dev, then Prod).
--
-- Extends the opt-in check-in feature (migration 014) so users can choose their
-- own reflection cadence, not just biweekly/monthly. Requested by the founder:
-- "let them choose their own reflection schedule" (every Monday, Wed+Sat,
-- weekly, etc.).
--
-- Still opt-in and still gentle: 'weekly' is the tightest cadence offered, and
-- 'custom_days' lets the user name specific weekdays. The digest cron
-- (/api/notifications/digest ?mode=memory_checkin) reads these and enforces the
-- per-cadence cooldown, exactly as it already does for biweekly/monthly.
--
-- NOTE: the user-facing labels for the new options are PROVISIONAL, pending the
-- same copy word-review as the frozen check-in copy (see
-- src/lib/copy/scheduleOptions.ts). The stored values below are stable.

-- 1. Widen the allowed cadence values. The inline check from 014 is
--    auto-named users_check_in_frequency_check — drop and re-add it.
alter table users
  drop constraint if exists users_check_in_frequency_check;

alter table users
  add constraint users_check_in_frequency_check
  check (check_in_frequency in ('off', 'weekly', 'biweekly', 'monthly', 'custom_days'));

-- 2. Selected weekdays for check_in_frequency = 'custom_days'.
--    Values are 0–6 (0 = Sunday … 6 = Saturday), matching JS Date.getUTCDay().
--    Empty for every other cadence. Evaluated against the daily cron's UTC day.
alter table users
  add column if not exists check_in_days smallint[] not null default '{}';

comment on column users.check_in_frequency is
  'Opt-in cadence for gentle check-in emails: off (default) | weekly | biweekly | monthly | custom_days. weekly is the tightest offered — the product enforces "gentle" by not offering anything daily.';

comment on column users.check_in_days is
  'Weekdays (0=Sun..6=Sat, UTC) the user chose when check_in_frequency = custom_days. Empty for all other cadences. Matched against the daily digest cron''s UTC weekday.';
