# Admin Auth: per-person accounts + MFA — rollout runbook

*Compliance finding #1. Branch: `admin-auth-mfa`. This change is designed to be
**non-breaking**: deploying it locks nobody out, because the shared `ADMIN_SECRET`
keeps working as a break-glass login until you deliberately retire it.*

## What changed

- **`admin_users` table** (migration `021`) — per-person accounts with scrypt
  password hashes and optional TOTP (RFC 6238) MFA.
- **Signed session cookie** — the `admin_session` cookie is now an HMAC-signed
  token (`src/lib/admin/session.ts`), not the raw secret. A stolen/logged cookie
  no longer reveals the admin password. Verified in both the Node routes and the
  Edge middleware (Web Crypto only).
- **Login** (`/api/admin/auth`) accepts either an email + password (+ MFA code)
  for a per-person account, or password-only for the break-glass shared secret.
- **Both verifiers** (`isAdminAuthenticated`, middleware) accept a signed token
  OR a legacy raw-secret cookie (so sessions active at deploy time keep working).
- **`scripts/create-admin.js`** provisions accounts and prints the TOTP enrolment URI.

## Rollout — do these in order, verifying at each step

1. **Deploy the branch** (merge to `main`). Nothing changes yet: break-glass
   login still works, existing sessions still valid.
2. **Apply migration 021** in the Supabase SQL Editor (prod, then dev/qa).
3. **Create your account:**
   ```bash
   ADMIN_EMAIL=you@soulspacehealth.org ADMIN_PASSWORD='a-long-strong-password' \
   SUPABASE_PROD_URL=... SUPABASE_PROD_SERVICE_KEY=... \
     node scripts/create-admin.js
   ```
   Add the printed `otpauth://` URI to your authenticator app.
4. **Verify per-person login** at `/admin/login`: enter your email, password, and
   the 6-digit code. Confirm you reach the panel and that `admin_audit_log` shows
   an `admin.login` row with your email as `actor`.
5. **Create the other admins** the same way. Each enrols their own MFA.
6. **Only once everyone can log in per-person**, retire break-glass:
   - Remove the two `token === secret` / `password === secret` break-glass
     branches (in `auth.ts`, `middleware.ts`, and the auth route), and
   - rotate `ADMIN_SECRET` to a fresh random value kept offline as a true
     emergency key (or drop it entirely).
   Do this as a separate small PR after step 5 is proven.

## Testing notes / limits

- Built and type-checked; the Edge middleware compiles against the Web-Crypto
  session module. Full login/MFA flow needs a real Supabase project + a
  provisioned account, so exercise it on **dev** first (steps 2–4 against dev).
- `ADMIN_SESSION_SECRET` is optional — the token signing key falls back to
  `ADMIN_SECRET`, so no new env var is required. Set a dedicated
  `ADMIN_SESSION_SECRET` if you want token-signing independent of the break-glass
  secret (recommended before step 6).

## Future hardening (tracked, not in this branch)

- Encrypt `totp_secret` at rest with the app AES key.
- Admin-managed enrolment UI (reset MFA, disable an account) instead of the CLI.
- Rate-limit `/api/admin/auth` per-IP at the login route (middleware already
  rate-limits `/api/admin/*`).
