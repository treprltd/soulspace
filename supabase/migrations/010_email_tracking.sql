-- ── Migration 010: Email delivery tracking ────────────────────────────────────
--
-- Adds two columns to public.users:
--
--   welcome_email_sent_at      — when the welcome email was sent (null = not yet)
--   last_re_engagement_sent_at — when the last re-engagement email was sent
--
-- These replace the fragile "session count" check that was previously used to
-- decide whether a user is "new". A session count of 0 fails for users who try
-- the app anonymously before registering — session recovery creates a row before
-- the welcome email fires.
--
-- Apply in Supabase SQL Editor for each environment (dev, test, production):
--   Settings → SQL Editor → paste → Run

alter table public.users
  add column if not exists welcome_email_sent_at      timestamptz default null,
  add column if not exists last_re_engagement_sent_at timestamptz default null;

-- Index: fast lookup for digest cron (find users eligible for re-engagement)
create index if not exists users_re_engagement_idx
  on public.users(last_re_engagement_sent_at)
  where last_re_engagement_sent_at is not null;
