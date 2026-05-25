-- Soul Space — Add life situation to sessions table
-- ─────────────────────────────────────────────────────────────────────────────
-- The situation picker (introduced alongside migration 008) lets users choose
-- a concrete life context (e.g. "Work or career", "A relationship", "Loss or
-- grief") before entering the session flow.  The selected situation is mapped
-- internally to one of the four resonance branches (A/B/C/D) and is now also
-- stored here for display in session history and future pattern analysis.
--
-- The column is nullable — sessions created before this migration will have
-- situation = NULL and will fall back to branch-label display in the UI.
--
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

alter table sessions
  add column if not exists situation text;

-- Optional index for future "show all sessions where situation = X" queries
create index if not exists sessions_situation_idx on sessions(situation)
  where situation is not null;
