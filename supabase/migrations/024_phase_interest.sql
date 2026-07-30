-- Migration 024: Phase 2/3 interest signals
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for each environment (Dev, then Prod).
--
-- Captures how beta users react to short previews of where Soul Space is headed,
-- shown at the end of the experience (after Phase 1 feedback). Lets us learn
-- which future direction would actually make people return BEFORE we build it.
--
-- One row per reaction. A user may react to both Phase 2 and Phase 3 (and may
-- change their mind on a later visit — we keep every row for the research trail,
-- exactly like the feedback table).

create table if not exists phase_interest (
  id          uuid        primary key default gen_random_uuid(),
  -- Nullable: a reaction may come from an anonymous session. When present it
  -- references the account (cascade-deleted with the user, like feedback).
  user_id     uuid        references public.users(id) on delete cascade,

  -- Which future phase the reaction is about.
  phase       smallint    not null check (phase in (2, 3)),

  -- The three-way reaction.
  reaction    text        not null check (reaction in (
                            'would_use', 'interested_concerns', 'not_useful'
                          )),

  -- Optional free-form answer to "What excites you, concerns you, or would make
  -- this more useful?"
  comment     text        check (char_length(comment) <= 2000),

  created_at  timestamptz not null default now()
);

-- Admin research queries: reaction mix per phase, and time ranges.
create index if not exists phase_interest_phase_idx
  on phase_interest (phase, reaction);
create index if not exists phase_interest_created_at_idx
  on phase_interest (created_at desc);
create index if not exists phase_interest_user_idx
  on phase_interest (user_id, created_at desc)
  where user_id is not null;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Writes go through /api/phase-interest using the service role (which bypasses
-- RLS), same as the Mirror + memory-preference writes. RLS is enabled with no
-- public policies so nothing is readable/writable directly by anon/auth clients.
alter table phase_interest enable row level security;
