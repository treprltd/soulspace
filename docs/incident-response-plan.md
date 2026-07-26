# Soul Space — Incident Response, Disaster Recovery & Business Continuity Plan

*Version 1.0 · July 2026 · Addresses compliance finding #7 (SOC 2, ISO 27001, HIPAA all
require a documented, maintained plan). This is the working baseline; roles and contact
details marked `[FILL IN]` must be completed by leadership.*

---

## 1. Purpose & scope

This plan governs how Soul Space detects, responds to, and recovers from security incidents,
outages, and data loss. It covers the production system: the Next.js app on AWS Amplify, the
Supabase (Postgres) database, and the sub-processors Anthropic (AI), Brevo (email), Stripe
(billing), and Sentry (error monitoring).

Because Soul Space stores sensitive emotional-reflection content, any confirmed exposure of
user session content or PII is treated as **Severity 1** regardless of scale.

## 2. Roles

| Role | Responsibility | Who |
|---|---|---|
| Incident Commander | Owns the response, makes call on severity and disclosure | `[FILL IN — founder/CTO]` |
| Technical Lead | Executes containment/recovery | `[FILL IN]` |
| Communications | User/partner/regulator notice | `[FILL IN]` |
| Legal/Privacy | Breach-notification obligations (GDPR 72h, state laws) | `[FILL IN — counsel]` |

For a solo/small team, one person may hold several roles — name them explicitly anyway.

## 3. Severity levels

| Sev | Definition | Examples | Target response |
|---|---|---|---|
| **S1** | Confirmed exposure/loss of user content or PII; safety pipeline down | DB breach, encryption-key leak, safety classifier hard-down | Immediate, all hands |
| **S2** | Security weakness, no confirmed exposure; major outage | Admin credential leak (no access yet), site down >15 min | < 1 hour |
| **S3** | Degraded/limited-impact | Single sub-processor degraded, elevated error rate | < 1 business day |

## 4. Incident response lifecycle

1. **Detect** — sources: Sentry alerts, `/api/health` (`status: degraded` → 503), Amplify build/deploy failures, admin `admin.login_failed` audit spikes (migration 020), user reports via `/contact`, sub-processor status pages.
2. **Triage** — Incident Commander assigns severity, opens a timestamped incident log (who/what/when — the same evidence an auditor will ask for).
3. **Contain** — stop the bleeding (see playbooks §5). Preserve evidence before wiping.
4. **Eradicate** — remove the root cause (rotate secrets, patch, revert deploy).
5. **Recover** — restore service, verify with `/api/health` and the smoke suite (`BASE_URL=… node scripts/smoke-test.js`).
6. **Post-incident** — within 5 business days, write a blameless post-mortem: timeline, root cause, what worked, action items with owners. File in `docs/incidents/`.

## 5. Playbooks

### 5.1 Suspected data breach (S1)
1. Incident Commander declares S1; start the incident log.
2. Rotate the exposed credential immediately (see §5.2 map).
3. Assess scope via Supabase logs and the admin audit log (migration 020).
4. Preserve evidence (export relevant logs before any destructive remediation).
5. Legal determines notification duties: **GDPR Art. 33 — 72 hours** to the supervisory authority; US state laws vary. HIPAA breach rules apply **only** if a BAA/PHI relationship exists (see finding #5).
6. Communications drafts user notice; do not overstate or understate.

### 5.2 Credential / secret compromise — rotation map
| Secret | Where | Rotate by |
|---|---|---|
| `ENCRYPTION_KEY` | Amplify env | **Do not rotate blindly — existing ciphertext is keyed to it.** Requires the key-versioning rollout (finding #4). Treat as S1; involve Technical Lead. |
| `SUPABASE_*_SERVICE_KEY` | Amplify env + Supabase | Regenerate in Supabase dashboard → update Amplify → redeploy |
| `ANTHROPIC_API_KEY` | Amplify env | Revoke in Anthropic console → issue new → update Amplify |
| `STRIPE_SECRET_KEY` / webhook secret | Amplify env + Stripe | Roll in Stripe dashboard → update Amplify |
| `BREVO_API_KEY` | Amplify env + Brevo | Revoke in Brevo → new key → update Amplify |
| `ADMIN_SECRET` | Amplify env | Change value → redeploy (invalidates all admin sessions; see finding #1) |

### 5.3 Encryption-key exposure (S1)
The current single static `ENCRYPTION_KEY` has no rotation mechanism (finding #4). If it is
exposed: treat all stored session content as potentially compromised, notify per §5.1, and
execute the key-versioning migration (finding #4 plan) before re-encrypting under a new key
version. **This is the top argument for prioritising the KMS/key-versioning work.**

### 5.4 Safety classifier failure (S1 — product safety)
The classifier now **fails safe**: on a malformed response it routes to the crisis path
rather than letting content through (finding #3). If Anthropic is fully down, `runMirror`
throws and the Mirror returns an error rather than an unclassified reflection — fail-closed.
Verify: no session should ever render a Mirror without a classifier verdict. Monitor Sentry
for `SafetyFlagError` spikes and Anthropic outages.

### 5.5 Sub-processor outage (S2/S3)
- **Supabase down** → app returns 5xx; `/api/health` reports `supabase:false`. No safe fallback (it is the system of record). Post status, wait for recovery, verify with smoke suite.
- **Anthropic down** → Mirror unavailable (fail-closed). Show the offline/error state.
- **Brevo down** → transactional email queues/fails; non-critical, retry later.
- **Stripe down** → checkout unavailable; existing entitlements unaffected.

## 6. Disaster recovery

- **Backups:** Supabase provides automated daily backups; enable **Point-in-Time Recovery (PITR)** on the production project if not already on. `[FILL IN — confirm PITR enabled + retention window]`.
- **Restore procedure:** Supabase dashboard → Database → Backups → restore to a point in time or new project; repoint `SUPABASE_PROD_*` env vars; redeploy; verify with `/api/health` + smoke suite.
- **Code:** source of truth is GitHub (`main` = production). Amplify redeploys from `main`. A bad deploy is recovered by reverting the commit and letting Amplify redeploy.
- **Secrets:** documented in the rotation map (§5.2); custody + recovery owner `[FILL IN]`.
- **RPO target:** `[FILL IN — e.g. ≤ 24h without PITR, near-zero with PITR]`.
- **RTO target:** `[FILL IN — e.g. ≤ 4h for full restore]`.

## 7. Business continuity

- Single-region Amplify + Supabase; document the accepted risk or a multi-region plan `[FILL IN]`.
- Admin panel access depends on `ADMIN_SECRET` custody — ensure at least two trusted parties can recover it.
- Key-person risk: document who can access Amplify, Supabase, the domain registrar, and each sub-processor console.

## 8. Contacts & escalation

| Party | Contact |
|---|---|
| Incident Commander | `[FILL IN]` |
| Legal/Privacy counsel | `[FILL IN]` |
| Supabase support | dashboard → support (paid plan for SLA) |
| Anthropic / Stripe / Brevo | respective consoles |
| Crisis-content escalation (988 routing intact?) | verify `tel:988` + `/crisis` on every incident touching the session flow |

## 9. Maintenance

Review this plan quarterly and after every S1/S2 incident. Store post-mortems in
`docs/incidents/`. This plan is a living document; an auditor will check that it is dated,
owned, tested (at least a tabletop exercise), and updated.
