-- 019: Lifecycle nudge tracking columns
--
-- Two once-ever lifecycle emails (see /api/notifications/digest ?mode=lifecycle):
--   activation_nudge_sent_at  — stamped when the "your first reflection is
--                               ready" email is sent to a registered user who
--                               never started a session (2–21 days post-signup)
--   first_followup_sent_at    — stamped when the "how has it sat with you?"
--                               email is sent 3–7 days after a user's FIRST
--                               completed session, if they haven't returned
--
-- Both are send-once markers, mirroring welcome_email_sent_at. NULL means
-- "never sent". Additive + idempotent — safe to run on any environment.

alter table public.users
  add column if not exists activation_nudge_sent_at timestamptz default null;

alter table public.users
  add column if not exists first_followup_sent_at timestamptz default null;

-- Partial indexes: the digest cron filters on "is null" every run.
create index if not exists users_activation_nudge_pending_idx
  on public.users (created_at)
  where activation_nudge_sent_at is null;

create index if not exists users_first_followup_pending_idx
  on public.users (id)
  where first_followup_sent_at is null;
