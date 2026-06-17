-- ── Migration 017: Contact form submissions ────────────────────────────────
--
-- Stores every contact form submission so admins can view, filter, and reply
-- to users directly from the admin panel.
--
-- Apply in Supabase SQL Editor for each environment (dev, qa, production):
--   Settings → SQL Editor → paste this file → Run

create table if not exists contact_submissions (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 100),
  email       text        not null,
  category    text        not null,
  sub_option  text        not null default '',
  message     text        not null check (char_length(message) between 10 and 4000),
  replied     boolean     not null default false,
  reply_body  text,
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists contact_submissions_created_at_idx
  on contact_submissions(created_at desc);

create index if not exists contact_submissions_replied_idx
  on contact_submissions(replied, created_at desc);

create index if not exists contact_submissions_email_idx
  on contact_submissions(email);

-- ── Row-Level Security ────────────────────────────────────────────────────────

alter table contact_submissions enable row level security;

-- No user-facing RLS policies — submissions are written via the API route
-- (server-side, no auth context) and read/updated via admin service role only.
-- The service role bypasses RLS by design; no explicit policy needed for it.
