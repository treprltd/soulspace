-- 015_pending_profiles.sql
--
-- Server-side bridge for the /auth/register → magic-link → /auth/callback flow.
--
-- Problem: /auth/register snapshots the entered profile (name, DOB, phone,
-- gender) into localStorage (`ss_pending_profile`) so /auth/callback can save
-- it once the magic link is clicked and the user is authenticated. This works
-- when the link opens in the SAME browser/profile the user registered in —
-- but magic-link emails are very often opened in a DIFFERENT browser, a
-- different browser profile, a different device, or a private/InPrivate
-- window with a separate storage partition. In all of those cases localStorage
-- set during registration is invisible to the callback tab, the bridge
-- silently fails, the user is bounced to /profile/setup to re-enter everything,
-- and (until they do) /settings shows every personal-info field blank.
--
-- Fix: ALSO stash the entered profile here, keyed by email, the moment the
-- user submits the registration form (before the magic link is sent). Once
-- the user authenticates — in any browser, on any device — /auth/callback can
-- look this row up by the now-verified email address and apply it server-side,
-- with no dependency on client-side storage surviving the trip.
--
-- This table is intentionally keyed by email (not user id): at registration
-- time the auth.users row may not exist yet / has no confirmed session, so
-- there is nothing to key on except the address the magic link is sent to.
-- Rows are short-lived — consumed (and deleted) by /auth/callback on first
-- successful sign-in, and opportunistically swept after 7 days by the
-- `expires_at` check in the consume endpoint so abandoned registrations don't
-- accumulate PII indefinitely.

create table if not exists pending_profiles (
  email      text primary key,
  first_name text not null,
  last_name  text not null,
  dob        date not null,
  phone      text not null,
  gender     text not null,
  created_at timestamptz not null default now()
);

comment on table pending_profiles is
  'Short-lived, server-side bridge for profile data entered at /auth/register, '
  'consumed by /auth/callback once the user authenticates via magic link — '
  'regardless of which browser/device/profile the link is opened in. '
  'Rows are deleted on consumption; stale rows (>7 days) are ignored and '
  'opportunistically purged. Service-role access only — no client-facing '
  'policies, since the row exists before the user has an authenticated session.';

alter table pending_profiles enable row level security;
-- No RLS policies: this table is written (POST /api/auth/pending-profile) and
-- read/consumed (POST /api/auth/pending-profile/consume) exclusively via the
-- service-role client from trusted API routes — never directly from the
-- browser's anon-key client. RLS is enabled with zero policies so the table
-- is fully inaccessible to anon/authenticated roles by default (defense in depth).

create index if not exists pending_profiles_created_at_idx on pending_profiles (created_at);
