# Soul Space — Compliance Remediation Tracker

*Responds to every finding in "Compliance Readiness Gap Analysis" (July 2026). Status as of
this commit. "Code — shipped" means merged and deployed; "Code — needs migration" means the
code is merged but a Supabase migration must be applied to production to activate it.*

| # | Finding | Priority | Status |
|---|---|---|---|
| 3 | Safety classifier fails open on parse error | High | ✅ Code — shipped |
| 1 | Shared admin password; cookie = raw secret; no MFA | High | ⏳ Plan below (deliberately not code-changed this push) |
| 2 | No admin action audit log | High | ⚙️ Code — needs migration 020 |
| 6 | Data export is a manual email process | Med | ✅ Code — shipped (endpoint) |
| 8 | CI audit informational; no automated dep updates | Low | ✅ Code — shipped |
| 9 | Secret scanning is a hand-written regex | Low | ✅ Code — shipped (gitleaks) |
| 11 | CLAUDE.md names Vercel/Resend (actual: Amplify/Brevo) | Low | ✅ Code — shipped |
| 7 | No IR / DR / BC plan in repo | Med | ✅ Docs — shipped (`docs/incident-response-plan.md`) |
| 4 | Static encryption key, no rotation/KMS | Med | ⏳ Plan below (infra) |
| 5 | No signed BAAs/DPAs with sub-processors | Med | ⚖️ Legal — not code |
| 10 | No teen/student-specific privacy review | Med | ⚖️ Legal — not code |
| 12 | PCI SAQ-A eligibility unconfirmed | Low | ⚖️ Confirm with Stripe |

---

## What shipped in code

- **#3 — Safety fail-safe.** `src/lib/safety/classifier.ts` now returns `flagged: true`
  (`acute_crisis`) on any unparseable/empty classifier response, so a malformed verdict routes
  to the crisis path instead of silently passing. Covered by 5 mocked tests in
  `__tests__/unit/safety-classifier-failsafe.test.ts` (run in CI, no API key needed).
- **#2 — Admin audit log.** `admin_audit_log` table (migration `020`), best-effort writer
  `src/lib/admin/audit.ts`, wired into admin login (success + failed attempts), user plan
  changes, and contact replies. Writes degrade silently until the migration is applied — no
  admin action can be broken by logging. **Action required: apply migration 020 to prod** (and
  dev/qa) via the Supabase SQL Editor.
- **#6 — Self-service export.** `GET /api/user/data` returns the authenticated user's full
  data (profile, sessions, decrypted content) as a downloadable JSON — mirrors the existing
  DELETE endpoint. *Follow-up: add a "Download my data" button in Settings that calls it.*
- **#8 — CI + deps.** `npm audit` now blocks on **critical**; `.github/dependabot.yml` opens
  weekly grouped update PRs for npm + Actions.
- **#9 — Secret scanning.** Replaced the regex with **gitleaks** in CI (`.gitleaks.toml`
  allowlists test fixtures/CI stubs). *Watch the first CI run and tune the allowlist if a
  known-safe placeholder trips it.*
- **#11 — Docs.** CLAUDE.md now says AWS Amplify + Brevo.
- **#7 — IR/DR/BC.** `docs/incident-response-plan.md` (roles/contacts marked `[FILL IN]`).

## Plans for the items deliberately not code-changed this push

### #1 — Per-person admin accounts + MFA (the largest single gap)
**Not changed in this push on purpose:** every variant touches the Edge-runtime admin gate in
`src/middleware.ts` as well as `src/lib/admin/auth.ts`, and a mistake there locks admins out
of production. That risk was not worth taking in the same deploy window as a demo. Recommended
rollout, each step non-breaking:
1. Add an `admin_users` table (or a `role` claim on Supabase auth users) + a role check.
2. Provision the first per-person admin account(s) in prod **before** enforcing anything.
3. Replace the raw-secret cookie with a signed token verified identically in the Node route
   and the Edge middleware (Web Crypto HMAC works in both runtimes) — so the secret never
   travels in the cookie.
4. Add TOTP MFA via Supabase Auth MFA at admin login.
5. Keep `ADMIN_SECRET` working as a break-glass fallback until per-person accounts are proven,
   then retire it.
Once #1 lands, the audit log's `actor` (#2) automatically records the individual admin.

### #4 — Encryption key rotation / KMS
The encryption module already stamps a per-ciphertext `keyRef` (`v1`) — the rotation seam
exists. What's missing is (a) storing key material in a managed KMS/Secrets Manager instead of
a static env var, and (b) a `decrypt` path that selects the key by the stored `keyRef` so a
`v2` key can be introduced without breaking `v1` data. This is primarily **AWS provisioning**
(create a KMS key, grant the Amplify role access) plus a backward-compatible code change;
runtime encryption was intentionally left untouched here to avoid any risk to existing
ciphertext before the demo. See the encryption-exposure playbook in the IR plan.

### #5, #10, #12 — Legal / organizational (no code)
- **#5** Signed BAAs (Supabase, Anthropic, Stripe) + DPA (Brevo) — hard prerequisites for
  HIPAA/GDPR; counsel-driven.
- **#10** Teen/student privacy review — the age gate serves teens and the pilot is a school;
  broader than the FERPA thread already underway with Mission College.
- **#12** Have counsel confirm PCI SAQ-A eligibility with Stripe (likely already true given
  hosted Checkout) and document it.

## Operational checklist (do these to fully activate this push)
- [ ] Apply migration `020_admin_audit_log.sql` to prod (and dev/qa).
- [ ] Watch the first CI run for gitleaks false positives; tune `.gitleaks.toml` if needed.
- [ ] Fill in roles/contacts/RTO/RPO in `docs/incident-response-plan.md`; confirm Supabase PITR.
- [ ] Add a "Download my data" button in Settings calling `GET /api/user/data`.
- [ ] Schedule the #1 admin-auth work as its own change (not a demo-week deploy).
