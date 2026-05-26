-- ── Migration 009: Beta feedback table ───────────────────────────────────────
--
-- Stores structured feedback from beta users. Each row is one submission.
-- Multiple submissions per user are allowed — useful for tracking how
-- sentiment evolves over the beta period.
--
-- Apply in Supabase SQL Editor for each environment (dev, test, production):
--   Settings → SQL Editor → paste this file → Run

create table if not exists feedback (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.users(id) on delete cascade,

  -- Q1: Star rating
  overall_rating    int         check (overall_rating between 1 and 5),

  -- Q2: Frequency of use
  use_frequency     text        check (use_frequency in (
                                  'first_time', 'few_times', 'weekly', 'daily_or_more'
                                )),

  -- Q3: Most valuable aspects (multi-select, stored as array)
  most_valuable     text[]      default '{}',

  -- Q4: Ease of navigation
  ease_of_use       text        check (ease_of_use in (
                                  'very_difficult', 'difficult', 'neutral', 'easy', 'very_easy'
                                )),

  -- Q5: What would make it better (multi-select)
  improvements      text[]      default '{}',

  -- Q6: Would recommend
  would_recommend   text        check (would_recommend in (
                                  'yes_already', 'yes_likely', 'maybe', 'not_yet'
                                )),

  -- Q7: Free-form comments
  comments          text        check (char_length(comments) <= 2000),

  created_at        timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Efficient lookup of a user's feedback history (dashboard + admin)
create index if not exists feedback_user_id_idx
  on feedback(user_id, created_at desc);

-- Created-at index for admin time-range queries
create index if not exists feedback_created_at_idx
  on feedback(created_at desc);

-- ── Row-Level Security ────────────────────────────────────────────────────────

alter table feedback enable row level security;

-- Users may insert their own feedback
create policy "Users can insert their own feedback"
  on feedback for insert
  with check (user_id = auth.uid());

-- Users may read their own submissions (for "already submitted" check)
create policy "Users can read their own feedback"
  on feedback for select
  using (user_id = auth.uid());

-- Service role has full access (used by admin routes + API)
-- No explicit policy needed — service role bypasses RLS by design.
