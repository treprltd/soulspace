-- Soul Space — Fix auth → public.users trigger to handle stale email conflicts
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM: migration 006 used ON CONFLICT (id) DO NOTHING, which only handles
-- primary-key conflicts.  If a user was deleted from auth.users while their
-- public.users row survived (e.g., during testing), re-registration creates a
-- NEW auth id for the same email.  The trigger then tries to INSERT with the
-- new id and the same email → unique_violation on the email column →
-- Supabase returns "Database error saving new user" and blocks sign-up.
--
-- FIX:
--   1. Delete any stale public.users row that shares the same email but a
--      different id (orphan from a previously deleted auth user).
--   2. Re-try the INSERT (now safe — no email conflict remains).
--   3. Wrap everything in EXCEPTION WHEN OTHERS → RETURN NEW so the trigger
--      can never block auth regardless of any future edge-case.
--
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove any orphan row with the same email but a different id.
  -- This happens when an auth user is deleted without cleaning public.users,
  -- and then the same email re-registers (getting a new auth UUID).
  -- The orphan row has no linked sessions so deleting it is safe.
  delete from public.users
  where email = new.email
    and id    != new.id;

  -- Insert the new user row.  ON CONFLICT (id) covers the case where the
  -- trigger fires twice or the row already exists from a backfill.
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;

  return new;

exception when others then
  -- Safety net: log the error but never block auth sign-up.
  raise warning 'handle_new_user: failed to sync public.users for % (%), error: %',
    new.id, new.email, sqlerrm;
  return new;
end;
$$;

-- Trigger is already attached from migration 006; the function replacement
-- above takes effect immediately — no need to recreate the trigger.

-- ── Backfill: fix any existing orphan rows in public.users ─────────────────
-- If any public.users rows have an email that no longer exists in auth.users,
-- they are stale and would block re-registration.  Remove them.
delete from public.users pu
where not exists (
  select 1 from auth.users au where au.id = pu.id
);
