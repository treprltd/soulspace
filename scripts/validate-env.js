#!/usr/bin/env node
/**
 * scripts/validate-env.js
 *
 * Validates that all required environment variables are present and sane
 * before allowing a build to proceed.
 *
 * Run automatically in Amplify preBuild phase (see amplify.yml) and in CI.
 * Also callable locally: node scripts/validate-env.js
 *
 * Exits 0 on success, 1 on failure.
 */

const env = process.env

// ---------------------------------------------------------------------------
// 1. REQUIRED — build/runtime will be broken without these
// ---------------------------------------------------------------------------
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'ENCRYPTION_KEY',
  'BREVO_API_KEY',
  'ADMIN_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ENV',
]

// ---------------------------------------------------------------------------
// 2. REQUIRED FOR PAYMENTS — must be set in prod; warn in other envs
// ---------------------------------------------------------------------------
const REQUIRED_FOR_PAYMENTS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_ESSENTIALS_PRICE_ID',
  'STRIPE_INSIGHTS_PRICE_ID',
]

// ---------------------------------------------------------------------------
// 3. FORMAT GUARDS — value present but wrong shape
// ---------------------------------------------------------------------------
const GUARDS = {
  ANTHROPIC_API_KEY: {
    test: (v) => v.startsWith('sk-ant-'),
    msg: 'Must start with sk-ant-',
  },
  ENCRYPTION_KEY: {
    test: (v) => v.length === 64 && /^[0-9a-f]+$/i.test(v),
    msg: 'Must be exactly 64 hex characters. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  },
  NEXT_PUBLIC_APP_URL: {
    test: (v) => v.startsWith('http'),
    msg: 'Must start with http:// or https://',
  },
  NEXT_PUBLIC_ENV: {
    test: (v) => ['local', 'dev', 'test', 'production'].includes(v),
    msg: 'Must be one of: local, dev, test, production',
  },
}

// ---------------------------------------------------------------------------
// 4. PRODUCTION-SPECIFIC GUARDS — extra checks when NEXT_PUBLIC_ENV=production
// ---------------------------------------------------------------------------
const PROD_GUARDS = {
  STRIPE_SECRET_KEY: {
    test: (v) => v.startsWith('sk_live_'),
    msg: 'Must use a LIVE Stripe key in production (sk_live_…). Test keys are not accepted.',
  },
  NEXT_PUBLIC_APP_URL: {
    test: (v) => v === 'https://soulspacehealth.org' || v.startsWith('https://'),
    msg: 'Must be an HTTPS URL in production.',
  },
  ANTHROPIC_API_KEY: {
    test: (v) => !v.includes('test') && !v.includes('demo'),
    msg: 'Looks like a test/demo key — double check this is the production key.',
  },
}

// ---------------------------------------------------------------------------
// Run checks
// ---------------------------------------------------------------------------
let errors = 0
let warnings = 0
const isProd = env.NEXT_PUBLIC_ENV === 'production'

console.log(`\n🔍  Soul Space env validator  [env: ${env.NEXT_PUBLIC_ENV ?? '(unset)'}]\n`)

// Required vars
for (const key of REQUIRED) {
  if (!env[key]) {
    console.error(`  ✗  MISSING: ${key}`)
    errors++
  } else {
    // Format guards
    if (GUARDS[key] && !GUARDS[key].test(env[key])) {
      console.error(`  ✗  INVALID: ${key} — ${GUARDS[key].msg}`)
      errors++
    } else {
      console.log(`  ✓  ${key}`)
    }
  }
}

// Payment vars — required in prod, warned in other envs
for (const key of REQUIRED_FOR_PAYMENTS) {
  if (!env[key]) {
    if (isProd) {
      console.error(`  ✗  MISSING (payments): ${key}`)
      errors++
    } else {
      console.warn(`  ⚠  MISSING (payments, ok in non-prod): ${key}`)
      warnings++
    }
  } else {
    console.log(`  ✓  ${key}`)
  }
}

// Production-specific guards
if (isProd) {
  console.log('\n  ── Production checks ──')
  for (const [key, guard] of Object.entries(PROD_GUARDS)) {
    if (env[key] && !guard.test(env[key])) {
      console.error(`  ✗  PROD VIOLATION: ${key} — ${guard.msg}`)
      errors++
    }
  }
}

// Summary
console.log('\n' + '─'.repeat(50))
if (errors > 0) {
  console.error(`\n❌  ${errors} error(s) found. Fix them before deploying.\n`)
  process.exit(1)
} else if (warnings > 0) {
  console.warn(`\n⚠   ${warnings} warning(s). OK for non-production.\n`)
  process.exit(0)
} else {
  console.log('\n✅  All environment variables are valid.\n')
  process.exit(0)
}
