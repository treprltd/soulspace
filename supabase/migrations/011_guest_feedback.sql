-- Migration 011: Allow guest feedback submissions
-- Makes user_id nullable and adds guest_email column with a check constraint
-- ensuring at least one identifier is present.

-- 1. Make user_id nullable (guests have no auth user)
alter table public.feedback
  alter column user_id drop not null;

-- 2. Add guest_email column (used when user_id is null)
alter table public.feedback
  add column if not exists guest_email text default null;

-- 3. Enforce: every row must have either a user_id OR a guest_email
alter table public.feedback
  add constraint feedback_has_identifier
  check (user_id is not null or guest_email is not null);

-- 4. Index for admin queries filtering by guest_email
create index if not exists feedback_guest_email_idx
  on public.feedback (guest_email)
  where guest_email is not null;
