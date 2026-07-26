-- ── Migration 020: Admin action audit log ──────────────────────────────────
--
-- Records privileged admin actions (logins, plan changes, contact replies,
-- safety-flag reviews) for SOC 2 / ISO 27001 / HIPAA audit-trail controls
-- (compliance finding #2). Writes are best-effort from the app — a failure to
-- log never blocks the underlying action (see src/lib/admin/audit.ts).
--
-- NOTE on `actor`: admin auth is currently a single shared secret (finding #1),
-- so `actor` is 'admin' for every row until per-person admin accounts exist.
-- Once they do, `actor` becomes the individual admin's identifier — the schema
-- already supports it.
--
-- Apply in the Supabase SQL Editor for each environment (dev, qa, production):
--   SQL Editor → paste this file → Run
--
-- Until this is applied, the app's audit writes fail silently (table missing)
-- and no admin action is affected.

create table if not exists admin_audit_log (
  id           uuid        primary key default gen_random_uuid(),
  actor        text        not null default 'admin',
  action       text        not null,
  target_type  text,
  target_id    text,
  metadata     jsonb,
  ip           text,
  created_at   timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on admin_audit_log(created_at desc);

create index if not exists admin_audit_log_action_idx
  on admin_audit_log(action, created_at desc);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Written and read only via the admin service role, which bypasses RLS. No
-- user-facing policies — regular users must never read the audit trail.
alter table admin_audit_log enable row level security;
