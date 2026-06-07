-- 016_pending_sessions.sql
--
-- Server-side bridge for the "complete a session anonymously, then create an
-- account to save it" flow — same root problem and same fix shape as
-- 015_pending_profiles.sql.
--
-- Flow today: an anonymous user finishes a session on /session/next-step,
-- clicks "Create free account", and the page snapshots the completed session
-- (branch, emotions, intensity, context, Mirror output, resonance tap) into
-- localStorage as `ss_pending_session` before routing to /auth/register.
-- /auth/callback later reads that key and POSTs it to /api/sessions/recover
-- so the session retroactively appears in their account.
--
-- That bridge only survives when the magic link is opened in the SAME
-- browser/profile/device the session was completed in. In practice it's very
-- often opened elsewhere — a different browser, browser profile, device, or
-- private/Incognito window with an isolated storage partition — in which case
-- localStorage written during the original session is invisible to the
-- callback tab, recovery silently no-ops, and the user's first completed
-- session simply vanishes: the dashboard shows "No sessions yet" and the
-- monthly quota still reads as untouched.
--
-- Fix: ALSO stash the completed-session snapshot here, keyed by the email the
-- user enters at /auth/register (the same moment /auth/register stages
-- `pending_profiles`) — so /auth/callback can recover it by the now-VERIFIED
-- email regardless of where the magic link is opened.
--
-- Keyed by email for the same reason as pending_profiles: there is no
-- authenticated user (and often no auth.users row with a confirmed session)
-- at the moment this is staged.

create table if not exists pending_sessions (
  email        text primary key,
  session_data jsonb not null,
  created_at   timestamptz not null default now()
);

comment on table pending_sessions is
  'Short-lived, server-side bridge for a completed-while-anonymous session '
  'snapshot taken on /session/next-step, consumed by /auth/callback once the '
  'user authenticates via magic link — regardless of which browser/device/'
  'profile the link is opened in. session_data mirrors the existing '
  'ss_pending_session localStorage shape (branch, situation, emotions, '
  'intensity, contextText, mirrorOutput, resonanceTap, savedAt) and is '
  're-validated in full by the same schema /api/sessions/recover already '
  'enforces before being written to `sessions`/`session_content`. Rows are '
  'deleted on consumption; the consume endpoint also enforces the existing '
  '1-hour TTL via the embedded savedAt, so stale rows are never replayed. '
  'Service-role access only — no client-facing policies (mirrors '
  'pending_profiles; the row exists before the user has an authenticated '
  'session, so RLS would have nothing to key off of).';

alter table pending_sessions enable row level security;
-- No RLS policies — written by POST /api/auth/pending-session and consumed by
-- POST /api/auth/pending-session/consume exclusively via the service-role
-- client. RLS enabled with zero policies makes the table fully inaccessible
-- to anon/authenticated roles by default (defense in depth, same as pending_profiles).

create index if not exists pending_sessions_created_at_idx on pending_sessions (created_at);
