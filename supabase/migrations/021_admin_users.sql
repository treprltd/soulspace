-- ── Migration 021: Per-person admin accounts + MFA ──────────────────────────
--
-- Replaces the single shared ADMIN_SECRET with individual admin accounts
-- (compliance finding #1). Each admin has a scrypt-hashed password and an
-- optional TOTP secret for MFA. The shared ADMIN_SECRET remains a break-glass
-- fallback until per-person accounts are provisioned and proven (see
-- docs/admin-auth-rollout.md), so applying this migration changes nothing on
-- its own — nobody is locked out.
--
-- Provision the first account AFTER applying this:
--   ADMIN_EMAIL=you@you.com ADMIN_PASSWORD='…' \
--   SUPABASE_PROD_URL=… SUPABASE_PROD_SERVICE_KEY=… \
--   node scripts/create-admin.js
--
-- Apply in the Supabase SQL Editor for each environment.

create table if not exists admin_users (
  id            uuid        primary key default gen_random_uuid(),
  email         text        unique not null,
  password_hash text        not null,               -- format: scrypt$<salt_hex>$<hash_hex>
  totp_secret   text,                               -- base32; null until MFA enrolled
  mfa_enabled   boolean     not null default false,
  disabled      boolean     not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists admin_users_email_idx on admin_users(lower(email));

-- Read/written only via the service role (bypasses RLS). No user-facing policy.
alter table admin_users enable row level security;

-- NOTE: totp_secret is stored as base32 plaintext, protected by service-role-only
-- access (same trust boundary as the rest of the admin data). Encrypting it at
-- rest with the app's AES key is a documented future hardening.
