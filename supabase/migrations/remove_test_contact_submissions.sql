-- ═══════════════════════════════════════════════════════════════════════════
-- Soul Space — Remove smoke-test contact submissions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PURPOSE
--   The Contact admin inbox (admin/contact) is showing 48 submissions that
--   are all output from an automated smoke-test run (scripts/smoke-test.js
--   or scripts/e2e-test.js), not real customer messages. Every row uses the
--   placeholder name "Ada"/"Ada Lovelace" and the IANA-reserved test domain
--   ada@example.com (example.com cannot receive real mail), with boilerplate
--   bodies like "This is a test message that meets the minimum length
--   requirement." and "AAAAAAAAA..." length-limit probes. All 48 rows were
--   created in two automated bursts seconds apart on 2026-06-17.
--
-- WHAT IS DELETED
--   ✓  contact_submissions rows where email = 'ada@example.com'
--
-- WHAT IS KEPT (untouched)
--   ✓  Every other table — users, sessions, feedback, subscriptions, events,
--      safety_events — none of those are touched by this script.
--   ✓  Any contact_submissions row from a different email address, even if
--      it also looks test-like (e.g. *.tester@* addresses found in feedback
--      are a separate, lower-confidence case and are NOT covered here).
--
-- WHERE TO RUN
--   Supabase Dashboard → SQL Editor → paste → Run
--   Must run as service role (SQL Editor always uses service role).
--   Run only against Production (or whichever environment actually has
--   this test data — check the BEFORE count first).
--
-- SAFETY
--   • Scoped to a single exact email match — cannot delete a real
--     submission, since example.com is not a deliverable domain.
--   • Idempotent — running twice deletes 0 rows the second time.
--   • Does NOT drop or alter the table structure.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Step 1: Snapshot BEFORE — confirm exactly what will be deleted ─────────

select
  'BEFORE DELETE'                                              as checkpoint,
  count(*)                                                     as matching_rows,
  count(*) filter (where email <> 'ada@example.com')           as rows_NOT_matching_should_be_0
from public.contact_submissions
where email = 'ada@example.com';

-- Sanity check — total submissions in the table right now, for reference.
select count(*) as total_contact_submissions from public.contact_submissions;

-- ── Step 2: Delete the smoke-test rows ──────────────────────────────────────

delete from public.contact_submissions
where email = 'ada@example.com';

-- ── Step 3: Snapshot AFTER — verify ────────────────────────────────────────

select
  'AFTER DELETE'                                                as checkpoint,
  (select count(*) from public.contact_submissions
     where email = 'ada@example.com')                           as remaining_test_rows_should_be_0,
  (select count(*) from public.contact_submissions)              as total_contact_submissions_remaining;

-- ═══════════════════════════════════════════════════════════════════════════
-- Expected result after delete:
--   remaining_test_rows_should_be_0      → 0
--   total_contact_submissions_remaining  → (total before minus 48)
-- ═══════════════════════════════════════════════════════════════════════════
