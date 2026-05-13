-- Soul Space Phase 1.2 — Admin Panel Indexes
-- Optimizes admin queries that aggregate across all users (service-role bypasses RLS)
-- Run against all 3 Supabase projects (dev first, then qa, then production)

-- ── SESSIONS ─────────────────────────────────────────────────────────────────

-- Admin: sessions list ordered by created_at (main admin sessions table)
create index if not exists sessions_created_desc
  on sessions(created_at desc);

-- Admin: sessions by branch for funnel analysis
create index if not exists sessions_branch_created
  on sessions(branch, created_at desc);

-- Admin: safety-flagged sessions
create index if not exists sessions_safety_flagged
  on sessions(safety_flagged, created_at desc)
  where safety_flagged = true;

-- Admin: resonance tap rate calculation (key metric)
create index if not exists sessions_resonance_tap_created
  on sessions(resonance_tap, created_at desc)
  where resonance_tap is not null;

-- Admin: completed sessions
create index if not exists sessions_completed_at
  on sessions(completed_at desc)
  where completed_at is not null;

-- ── USERS ────────────────────────────────────────────────────────────────────

-- Admin: users list by plan tier
create index if not exists users_plan_tier_created
  on users(plan_tier, created_at desc);

-- Admin: email search (case-insensitive prefix / substring)
create index if not exists users_email_lower
  on users(lower(email));

-- ── SAFETY EVENTS ────────────────────────────────────────────────────────────

-- Admin: unreviewed safety events (most critical view)
create index if not exists safety_events_unreviewed
  on safety_events(reviewed, timestamp desc)
  where reviewed = false;

-- ── EVENTS ───────────────────────────────────────────────────────────────────

-- Admin: events filtered by event_name
create index if not exists events_name_timestamp
  on events(event_name, timestamp desc);
