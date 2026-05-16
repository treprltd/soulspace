-- Soul Space — Apply migrations 002 + 003 to any DB that skipped them
-- Safe to run multiple times (all statements are idempotent).
-- Run in Supabase Dashboard → SQL Editor for each project (dev, qa, prod).

-- ═══════════════════════════════════════════════════════════════════════════
-- FROM 002_subscriptions.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── USERS: Stripe customer reference ─────────────────────────────────────
alter table users add column if not exists stripe_customer_id text unique;

-- ── SUBSCRIPTIONS table ───────────────────────────────────────────────────
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

-- Subscriptions indexes
create index if not exists subscriptions_user_id          on subscriptions(user_id);
create index if not exists subscriptions_stripe_sub_id    on subscriptions(stripe_subscription_id);
create index if not exists subscriptions_stripe_cust_id   on subscriptions(stripe_customer_id);

-- Subscriptions RLS
alter table subscriptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'subscriptions' and policyname = 'subscriptions_own_read'
  ) then
    create policy "subscriptions_own_read" on subscriptions
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FROM 003_admin_indexes.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Sessions
create index if not exists sessions_created_desc
  on sessions(created_at desc);

create index if not exists sessions_branch_created
  on sessions(branch, created_at desc);

create index if not exists sessions_safety_flagged
  on sessions(safety_flagged, created_at desc)
  where safety_flagged = true;

create index if not exists sessions_resonance_tap_created
  on sessions(resonance_tap, created_at desc)
  where resonance_tap is not null;

create index if not exists sessions_completed_at
  on sessions(completed_at desc)
  where completed_at is not null;

-- Users
create index if not exists users_plan_tier_created
  on users(plan_tier, created_at desc);

create index if not exists users_email_lower
  on users(lower(email));

-- Safety events
create index if not exists safety_events_unreviewed
  on safety_events(reviewed, timestamp desc)
  where reviewed = false;

-- Events
create index if not exists events_name_timestamp
  on events(event_name, timestamp desc);
