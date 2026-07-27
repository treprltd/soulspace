# Soul Space — Compliance Remediation Tracker

*Responds to every finding in "Compliance Readiness Gap Analysis" (July 2026).
"Live" = merged to main and deployed to production. "On branch" = code complete,
pending a deliberate merge/rollout.*

| # | Finding | Priority | Status |
|---|---|---|---|
| 3 | Safety classifier fails open on parse error | High | ✅ Live |
| 1 | Shared admin password; cookie = raw secret; no MFA | High | ✅ Live (per-person + MFA); break-glass retirement on branch |
| 2 | No admin action audit log | High | ✅ Live (migration 020 applied) |
| 6 | Data export is a manual email process | Med | ✅ Live (endpoint + Settings button) |
| 8 | CI audit informational; no automated dep updates | Low | ✅ Live |
| 9 | Secret scanning is a hand-written regex | Low | ✅ Live (gitleaks) |
| 11 | CLAUDE.md names Vercel/Resend (actual: Amplify/Brevo) | Low | ✅ Live |
| 7 | No IR / DR / BC plan in repo | Med | ✅ Live (`docs/incident-response-plan.md`) |
| 4 | Static encryption key, no rotation/KMS | Med | 🔶 Code complete on `kms-encryption` branch — pending dev test |
| 5 | No signed BAAs/DPAs with sub-processors | Med | ⚖️ Legal — not code |
| 10 | No teen/student-specific privacy review | Med | ⚖️ Legal — not code |
| 12 | PCI SAQ-A eligibility unconfirmed | Low | ⚖️ Confirm with Stripe |

**9 of 9 code-actionable findings are code-complete.** Only the 3 legal items (#5, #10, #12) remain outside code.

---

## Live in production

- **#3 — Safety fail-safe.** `src/lib/safety/classifier.ts` returns `flagged: true`
  (`acute_crisis`) on any unparseable/empty classifier response. 5 mocked tests.
- **#1 — Per-person admin accounts + MFA.** `admin_users` table (migration 021), scrypt
  passwords, RFC 6238 TOTP, HMAC-signed session cookie verified in both the Node routes and
  the Edge middleware. Confirmed working end-to-end (per-person login + MFA). The shared
  `ADMIN_SECRET` still works as break-glass — **retiring that is the one remaining step**
  (branch `retire-break-glass`).
- **#2 — Admin audit log.** `admin_audit_log` (migration 020, applied), best-effort writer,
  wired into admin login (incl. failed attempts), plan changes, contact replies.
- **#6 — Self-service export.** `GET /api/user/data` + a "Download my data" button in Settings.
- **#8 — CI + deps.** `scripts/audit-ci.js` blocks CI on criticals with a non-major fix;
  Dependabot opens weekly minor/patch PRs (majors ignored — they need manual migration).
- **#9 — Secret scanning.** gitleaks in a dedicated CI job; `.gitleaks.toml` allowlist.
- **#11 — Docs.** CLAUDE.md says AWS Amplify + Brevo.
- **#7 — IR/DR/BC.** `docs/incident-response-plan.md` (roles/contacts marked `[FILL IN]`).

## On branch — pending rollout

### #4 — KMS envelope encryption (`kms-encryption` branch)
AES-256-GCM envelope encryption via AWS KMS, gated behind `ENCRYPTION_KMS_KEY_ID`, fully
backward compatible (legacy `v1` blobs still decrypt; unset env var = no change). AWS side is
provisioned (KMS key `54510eb2-…`, Amplify compute role is a key user). **Mandatory dev test
before prod** — see `docs/kms-encryption-rollout.md`. The KMS path cannot be exercised without
live AWS, so it must be proven on dev (new session writes a `kms:` blob and reads back; old
data still decrypts) before promotion.

### #1 cleanup — retire break-glass (`retire-break-glass` branch)
Removes the shared-secret as a live login and stops the middleware/`isAdminAuthenticated` from
accepting a raw-secret cookie (signed tokens only). `ADMIN_SECRET` becomes an emergency-only
re-enable (env flag) rather than a standing credential. **Do not merge until `rema@` + MFA is
confirmed reliable and ideally a second admin exists** — recovery if locked out is re-running
`scripts/create-admin.js` with the Supabase service key.

### #5, #10, #12 — Legal / organizational (no code)
- **#5** Signed BAAs (Supabase, Anthropic; Stripe likely N/A — no PHI) + DPA (Brevo, AWS if
  HIPAA in scope). First question for counsel: is Soul Space even a HIPAA-covered entity given
  its non-clinical positioning?
- **#10** Teen/student privacy review — COPPA (age gate excludes under-13) + FERPA (school pilot).
- **#12** Have counsel confirm PCI SAQ-A eligibility with Stripe (hosted Checkout) and document it.

## Operational checklist
- [x] Apply migration `020_admin_audit_log.sql` (prod + dev).
- [x] Apply migration `021_admin_users.sql` and provision the first admin (prod).
- [x] Add a "Download my data" button in Settings.
- [ ] Watch a CI run for gitleaks false positives; tune `.gitleaks.toml` if needed.
- [ ] Fill in roles/contacts/RTO/RPO in `docs/incident-response-plan.md`; confirm Supabase PITR.
- [ ] Provision a **second** admin account (removes the single-point-of-failure before retiring break-glass).
- [ ] Dev-test and roll out KMS (`docs/kms-encryption-rollout.md`), then merge `retire-break-glass`.
- [ ] Legal: BAAs/DPAs (#5), teen-privacy review (#10), PCI SAQ-A confirmation (#12).
