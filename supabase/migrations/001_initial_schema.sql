-- Soul Space Phase 1 Initial Schema
-- Run: supabase db push

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ───────────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  created_at  timestamptz not null default now(),
  plan_tier   text not null default 'free' check (plan_tier in ('free', 'essentials', 'insights')),
  age_bracket text check (age_bracket in ('teen', 'adult'))
);

-- ── SESSIONS ────────────────────────────────────────────────────────────────
create table if not exists sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  branch          text check (branch in ('A','B','C','D')),
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  intensity       smallint check (intensity between 1 and 10),
  safety_flagged  boolean not null default false,
  season_assigned text check (season_assigned in ('W','Sp','Su','Au')),
  resonance_tap   text check (resonance_tap in ('accurate','not_quite')),
  char_count      int
);

-- ── SESSION CONTENT (encrypted) ─────────────────────────────────────────────
create table if not exists session_content (
  id                      uuid primary key default uuid_generate_v4(),
  session_id              uuid not null references sessions(id) on delete cascade,
  encrypted_context       text,
  encrypted_mirror_output text,
  encryption_key_ref      text not null,
  created_at              timestamptz not null default now()
);

-- ── EVENTS ──────────────────────────────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid references sessions(id) on delete cascade,
  user_hash   text,
  event_name  text not null,
  properties  jsonb,
  timestamp   timestamptz not null default now()
);

-- ── SAFETY EVENTS ────────────────────────────────────────────────────────────
create table if not exists safety_events (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid references sessions(id) on delete cascade,
  flag_type        text,
  branch           text,
  action           text not null default 'crisis_routed',
  season_suppressed boolean not null default true,
  reviewed         boolean not null default false,
  reviewed_at      timestamptz,
  timestamp        timestamptz not null default now()
);

-- ── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists sessions_user_created on sessions(user_id, created_at desc);
create index if not exists events_session_name_time on events(session_id, event_name, timestamp desc);
create index if not exists safety_events_reviewed on safety_events(reviewed, timestamp desc);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table users enable row level security;
alter table sessions enable row level security;
alter table session_content enable row level security;
alter table events enable row level security;
alter table safety_events enable row level security;

-- Users can only read/write their own row
create policy "users_own_row" on users
  for all using (auth.uid() = id);

-- Users can only access their own sessions
create policy "sessions_own" on sessions
  for all using (auth.uid() = user_id);

-- Users can only access content for their own sessions
create policy "session_content_own" on session_content
  for all using (
    exists (
      select 1 from sessions s
      where s.id = session_content.session_id
      and s.user_id = auth.uid()
    )
  );

-- Users can only read their own events
create policy "events_own" on events
  for all using (
    exists (
      select 1 from sessions s
      where s.id = events.session_id
      and s.user_id = auth.uid()
    )
  );

-- Safety events: users can read their own; write is service-role only
create policy "safety_events_read_own" on safety_events
  for select using (
    exists (
      select 1 from sessions s
      where s.id = safety_events.session_id
      and s.user_id = auth.uid()
    )
  );
