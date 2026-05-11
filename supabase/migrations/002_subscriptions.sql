-- Soul Space Phase 1.1 — Subscriptions Schema
-- Run against all 3 Supabase projects (dev first, then qa, then production)

-- ── USERS: add Stripe customer reference ─────────────────────────────────────
alter table users add column if not exists stripe_customer_id text unique;

-- ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_customer_id     text not null,
  plan_tier              text not null check (plan_tier in ('essentials', 'insights')),
  status                 text not null default 'active',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists subscriptions_user_id on subscriptions(user_id);
create index if not exists subscriptions_stripe_sub_id on subscriptions(stripe_subscription_id);
create index if not exists subscriptions_stripe_customer_id on subscriptions(stripe_customer_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table subscriptions enable row level security;

-- Users can read their own subscription row; writes are service-role only
create policy "subscriptions_own_read" on subscriptions
  for select using (auth.uid() = user_id);
