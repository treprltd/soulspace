-- 018_pending_profiles_optional_fields.sql
--
-- Phone and gender are no longer required to create an account (see
-- src/lib/profile/applyProfile.ts and src/components/ui/ProfileFields.tsx —
-- both fields were pure signup friction unrelated to auth or product use;
-- only first/last name and DOB, the 18+ compliance check, are required now).
--
-- pending_profiles.phone and .gender were created NOT NULL, which would
-- reject the upsert in POST /api/auth/pending-profile whenever a user
-- registers without entering them. The `users` table itself already allows
-- null phone/gender (profile_complete can be true without them) — this
-- migration brings pending_profiles in line with that.
--
-- Apply in Supabase SQL Editor for each environment (dev, qa, production):
--   Settings → SQL Editor → paste this file → Run

alter table pending_profiles alter column phone  drop not null;
alter table pending_profiles alter column gender drop not null;
