-- ═══════════════════════════════════════════════════════════════════════════
-- Soul Space — Activity Data Reset Script
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PURPOSE
--   Wipes all tracked activity so metrics start fresh from zero.
--   Use this before a new beta cohort or when you want a clean baseline.
--
-- WHAT IS DELETED
--   ✓  sessions          — all session rows (and cascades below)
--   ✓  session_content   — encrypted context + mirror outputs (cascade)
--   ✓  events            — all analytics events (cascade)
--   ✓  safety_events     — all safety flag records (cascade)
--   ✓  feedback          — all beta feedback submissions (auth + guest)
--   ✓  users.welcome_email_sent_at     — reset so welcome emails re-fire
--   ✓  users.last_re_engagement_sent_at — reset re-engagement cadence
--
-- WHAT IS KEPT (untouched)
--   ✓  auth.users            — Supabase authentication accounts
--   ✓  public.users          — profile data (name, DOB, phone, gender)
--   ✓  subscriptions         — Stripe billing records
--   ✓  users.plan_tier       — paid plan status (don't downgrade subscribers)
--   ✓  users.stripe_*        — Stripe customer references
--
-- WHERE TO RUN
--   Supabase Dashboard → SQL Editor → paste → Run
--   Must run as service role (SQL Editor always uses service role).
--   Run separately for each environment: Dev → QA → Production.
--
-- SAFETY
--   • Idempotent — safe to run multiple times (deletes what exists).
--   • Does NOT drop or alter any table structure.
--   • Does NOT delete auth users or user profiles.
--   • Does NOT touch Stripe subscriptions or billing data.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Step 1: Snapshot counts BEFORE the reset (for your records) ───────────

select
  'BEFORE RESET'                        as checkpoint,
  (select count(*) from public.sessions)       as sessions,
  (select count(*) from public.session_content) as session_content_rows,
  (select count(*) from public.events)         as events,
  (select count(*) from public.safety_events)  as safety_events,
  (select count(*) from public.feedback)       as feedback_rows,
  (select count(*) from public.users)          as user_profiles;

-- ── Step 2: Clear activity tables ─────────────────────────────────────────
-- TRUNCATE CASCADE handles all child rows in one operation.
-- Cascade order: sessions → session_content, events, safety_events (FK cascade).

truncate table public.sessions        restart identity cascade;
-- ↑ also truncates: session_content, events, safety_events (ON DELETE CASCADE)

truncate table public.feedback        restart identity cascade;

-- ── Step 3: Reset email tracking columns on users ─────────────────────────
-- Clears the sent-at timestamps so:
--   • Welcome emails will fire for these users on their next sign-in
--   • Re-engagement emails will start fresh on the next cron run

update public.users
set
  welcome_email_sent_at      = null,
  last_re_engagement_sent_at = null;

-- ── Step 4: Snapshot counts AFTER the reset (verify) ─────────────────────

select
  'AFTER RESET'                         as checkpoint,
  (select count(*) from public.sessions)       as sessions,
  (select count(*) from public.session_content) as session_content_rows,
  (select count(*) from public.events)         as events,
  (select count(*) from public.safety_events)  as safety_events,
  (select count(*) from public.feedback)       as feedback_rows,
  (select count(*) from public.users)          as user_profiles,
  (select count(*) from public.subscriptions)  as subscriptions_kept;

-- ═══════════════════════════════════════════════════════════════════════════
-- Expected result after reset:
--   sessions            → 0
--   session_content_rows → 0
--   events              → 0
--   safety_events       → 0
--   feedback_rows       → 0
--   user_profiles       → (same as before — profiles kept)
--   subscriptions_kept  → (same as before — billing kept)
-- ═══════════════════════════════════════════════════════════════════════════
