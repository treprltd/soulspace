-- Migration 026: Check-in reminders ON by default for NEW accounts
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ DO NOT RUN ON PROD YET. This flips a research-backed, founder-owned default
-- (check-ins were opt-in / off by default per beta findings). It is gated on:
--   1. Pooja's sign-off on the REWRITTEN consent copy (the frozen CHECK_IN_CONSENT
--      / SETTINGS_MEMORY_SECTION strings still say "Off by default" — they MUST be
--      updated to transparently disclose on-by-default BEFORE this ships, or the
--      product misrepresents consent to users), and
--   2. a quick consent/GDPR gut-check (pre-enabled defaults are invalid consent
--      for EU users; opt-out is riskier for a mental-health-adjacent product).
-- Run on DEV only for review until both are cleared.
--
-- Scope guardrails baked in:
--   • NEW accounts only. This changes the column DEFAULT, so it applies to future
--     signups (handle_new_user inserts without check_in_frequency → default wins).
--   • Existing users are NOT touched — they keep whatever they chose under the
--     original "off by default" promise. (No UPDATE statement here, deliberately.)
--   • Safety-flagged users remain excluded by the digest cron, and every check-in
--     email keeps its one-tap unsubscribe — neither changes here.
--
-- Default cadence = 'biweekly' (matches the existing toggleHint, "about once every
-- couple of weeks, at most"). Switch to 'monthly' if Pooja wants it gentler.

alter table users
  alter column check_in_frequency set default 'biweekly';

comment on column users.check_in_frequency is
  'Opt-out cadence for gentle check-in emails (as of migration 026, NEW accounts default to biweekly; existing accounts keep their prior value). off | weekly | biweekly | monthly | custom_days. weekly is the tightest offered.';
