# Production Cutover Runbook

## Pre-cutover checklist — complete in order

### 1. Stripe: switch to live keys

| Step | Action | Where |
|------|--------|--------|
| 1.1 | Log into Stripe Dashboard → switch to **Live mode** (toggle top-left) | stripe.com |
| 1.2 | Copy **Secret key** (`sk_live_…`) | Stripe → Developers → API keys |
| 1.3 | Set `STRIPE_SECRET_KEY=sk_live_…` in Amplify prod env vars | AWS Amplify → App settings → Environment variables |
| 1.4 | Create a new webhook endpoint in Stripe: `https://soulspacehealth.org/api/stripe/webhook` | Stripe → Developers → Webhooks → Add endpoint |
| 1.5 | Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` | Same dialog |
| 1.6 | Copy **Signing secret** (`whsec_…`) | Stripe → Webhooks → [your endpoint] → Signing secret |
| 1.7 | Set `STRIPE_WEBHOOK_SECRET=whsec_…` in Amplify | Amplify env vars |
| 1.8 | Copy the live **Price IDs** for Essentials and Insights plans | Stripe → Products → [plan] → Pricing |
| 1.9 | Set `STRIPE_ESSENTIALS_PRICE_ID` and `STRIPE_INSIGHTS_PRICE_ID` | Amplify env vars |
| 1.10 | Trigger a new Amplify build to embed the new env vars | Amplify → Run build |
| 1.11 | Make a **real card** test purchase ($1 trial or lowest tier) | Live browser |
| 1.12 | Confirm Supabase `subscriptions` row shows `plan_tier=essentials` | Supabase Studio → Table editor → subscriptions |
| 1.13 | Confirm confirmation email received from `noreply@soulspacehealth.org` | Email inbox |
| 1.14 | Confirm `/subscribe/success` → `/dashboard` (not pricing loop) | Browser |

### 2. Supabase: prod project setup

| Step | Action |
|------|--------|
| 2.1 | Create a **new Supabase project** for production (do not use dev project) |
| 2.2 | Run all migrations: `supabase db push` targeting prod project |
| 2.3 | Add `soulspacehealth.org` to **Auth → URL Configuration → Redirect URLs** |
| 2.4 | Configure custom SMTP (Brevo) in **Auth → SMTP Settings** |
| 2.5 | Enable **Point-in-Time Recovery** (requires Pro plan) |
| 2.6 | Update Amplify env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

### 3. Upstash Redis: prod database

| Step | Action |
|------|--------|
| 3.1 | Create a new Upstash Redis database at console.upstash.com (choose region closest to Amplify) |
| 3.2 | Copy **REST URL** and **REST Token** from database details |
| 3.3 | Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Amplify prod env vars |

### 4. Sentry: create prod project

| Step | Action |
|------|--------|
| 4.1 | Create a **Next.js project** in your Sentry organisation |
| 4.2 | Copy the **DSN** and set `NEXT_PUBLIC_SENTRY_DSN` in Amplify |
| 4.3 | Create an **auth token** (Sentry → Settings → Auth Tokens) for source map upload |
| 4.4 | Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Amplify |
| 4.5 | Configure Slack / email alerts in Sentry for new issues |

### 5. Encryption key

| Step | Action |
|------|--------|
| 5.1 | Generate a **fresh** 64-char hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| 5.2 | Set `ENCRYPTION_KEY` in Amplify prod env vars — **never reuse the dev key** |
| 5.3 | Store a backup of the key in a secrets manager (AWS Secrets Manager or 1Password) |

### 6. Brevo: verify sending domain

| Step | Action |
|------|--------|
| 6.1 | Log into Brevo → Settings → Senders & IP → Domains |
| 6.2 | Verify `soulspacehealth.org` is authenticated (SPF, DKIM, DMARC all green) |
| 6.3 | Send a test email to yourself from the Brevo console |

### 7. DNS cutover

| Step | Action |
|------|--------|
| 7.1 | In your DNS provider, point `soulspacehealth.org` to the Amplify app domain |
| 7.2 | Add `www` CNAME → Amplify domain (or redirect to apex) |
| 7.3 | Confirm SSL certificate is issued (Amplify auto-provisions via ACM) |
| 7.4 | Wait for DNS propagation (~5–30 min) |

### 8. Post-cutover verification

Run the smoke tests against prod:

```bash
BASE_URL=https://soulspacehealth.org ADMIN_SECRET=<your_secret> node scripts/smoke-test.js
```

All tests must pass before announcing launch.

---

## GitHub Actions secrets to set

Add these in **GitHub → Settings → Secrets → Actions**:

| Secret name | Description |
|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL_DEV` | Dev Supabase URL (already set) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV` | Dev anon key (already set) |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | Dev service role key |
| `NEXT_PUBLIC_SUPABASE_URL_PROD` | **Prod** Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | **Prod** service role key |
| `ANTHROPIC_API_KEY` | Anthropic API key (for AI tests in CI) |
| `ENCRYPTION_KEY_CI` | A valid 64-char hex key for CI builds (can be same as dev) |
| `STRIPE_SECRET_KEY_PROD` | Live Stripe secret key (for webhook health checks) |
| `ADMIN_SECRET_PROD` | Prod admin secret (for smoke tests) |

---

## Rollback plan

If anything goes wrong after DNS cutover:

1. Point DNS back to the previous host (or disable Amplify custom domain)
2. In Stripe, disable the live webhook endpoint (prevents orphaned subscription events)
3. Check Sentry for the root cause error
4. Fix in a hotfix branch → merge to `main` → Amplify auto-deploys
5. Re-run smoke tests before pointing DNS back
