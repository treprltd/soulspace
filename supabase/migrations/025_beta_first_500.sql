-- Migration 025: Auto-grant beta full access to the first 500 accounts
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for each environment (Dev, then Prod).
--
-- Founder's definition of the beta cohort: "the first 500 users who create an
-- account during the beta period" get the COMPLETE Phase 1 experience. Rather
-- than run scripts/grant-beta-access.js --first 500 once (which goes stale as
-- people keep joining), this makes it automatic at signup:
--
--   • A BEFORE INSERT trigger on public.users sets beta_full_access = true while
--     fewer than 500 accounts exist. Fires for every signup path (it sits on
--     public.users itself, not the auth trigger), and email is already set at
--     insert time by handle_new_user (see migration 007), so the exclusion works.
--   • A one-time backfill grants the current early accounts (there are far fewer
--     than 500 today), so they count toward the cohort.
--
-- EXCLUSION: the founder asked NOT to grant her own accounts beta access (see
-- session 2026-07-31 — "keep it only to venrythinvest"). Excluded addresses
-- never get auto-granted and are skipped by the backfill. Adjust the list in
-- both places below if that changes.
--
-- Depends on migration 022 (users.beta_full_access).

-- ── 1. Backfill the current early cohort (excluding the founder's addresses) ──
update public.users
set beta_full_access = true
where beta_full_access = false
  and (email is null or lower(email) not in ('poojasingh3462@gmail.com', 'founder@soulspacehealth.com'))
  and id in (
    select id from public.users
    where (email is null or lower(email) not in ('poojasingh3462@gmail.com', 'founder@soulspacehealth.com'))
    order by created_at asc
    limit 500
  );

-- ── 2. Auto-grant future signups while the first-500 window is open ──────────
create or replace function public.grant_beta_first_500()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Founder's own addresses never get auto-granted.
  if new.email is not null
     and lower(new.email) in ('poojasingh3462@gmail.com', 'founder@soulspacehealth.com') then
    return new;
  end if;

  -- Grant while fewer than 500 accounts exist. The row being inserted is not
  -- counted yet, so account #500 (count = 499) is the last one granted. A tiny
  -- race at the exact boundary may grant a couple extra — acceptable.
  if (select count(*) from public.users) < 500 then
    new.beta_full_access := true;
  end if;

  return new;
exception when others then
  -- Never let this convenience block a signup — fall back to the column default.
  return new;
end;
$$;

drop trigger if exists trg_grant_beta_first_500 on public.users;

create trigger trg_grant_beta_first_500
  before insert on public.users
  for each row
  execute function public.grant_beta_first_500();
