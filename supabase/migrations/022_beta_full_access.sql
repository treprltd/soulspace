-- Migration 022: Beta full access flag
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for each environment (Dev, then Prod).
--
-- Purpose: give the first ~500 beta feedback participants the COMPLETE Phase 1
-- experience (unlimited reflections) so they can react to the whole product,
-- without putting them on a paid plan or issuing comp Stripe subscriptions.
--
-- The free-tier gate in /api/mirror keys off users.plan_tier ('free' → capped
-- at FREE_SESSIONS_PER_MONTH). Rather than overload plan_tier (which is driven
-- by Stripe webhooks and would be clobbered on the next subscription event),
-- this adds an independent, additive flag the gate also honours. A beta user
-- keeps plan_tier = 'free' but is treated as unlimited.
--
-- Grant it with scripts/grant-beta-access.js (never edited by Stripe).

alter table users
  add column if not exists beta_full_access boolean not null default false;

comment on column users.beta_full_access is
  'When true, the /api/mirror free-tier session cap is bypassed for this user — used to give the first ~500 beta participants the full Phase 1 experience. Independent of plan_tier (which Stripe webhooks own), so it survives subscription events. Grant via scripts/grant-beta-access.js.';

-- Partial index: the mirror gate and admin queries look up "who has beta access".
create index if not exists users_beta_full_access_idx
  on users (beta_full_access)
  where beta_full_access = true;
