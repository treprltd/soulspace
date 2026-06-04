-- Soul Space — Add emotion_tags to sessions for Growth Map pattern detection
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard → SQL Editor for each environment (Dev, QA, Prod).
--
-- Why unencrypted?
--   emotion_tags are predefined app vocabulary (Overwhelmed, Conflicted, etc.)
--   not personal narrative. contextText and mirrorOutput remain encrypted.
--   Storing tags unencrypted enables server-side pattern queries without
--   per-request decryption of the heavier session_content rows.

alter table sessions
  add column if not exists emotion_tags text[] default '{}';

-- Index for fast pattern aggregation across a user's sessions
create index if not exists sessions_user_emotion_tags
  on sessions using gin (emotion_tags)
  where emotion_tags != '{}';
