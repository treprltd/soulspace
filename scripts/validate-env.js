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
// Supabase var resolution — accept either generic or env-specific naming.
//
// Amplify branches use SUPABASE_PROD_URL / SUPABASE_DEV_URL / SUPABASE_QA_URL
// (and matching ANON_KEY / SERVICE_KEY). The app code uses the generic names.
// next.config.mjs resolves them at build time; validate-env.js must do the
// same check here so missing values are caught early before the build spends time.
// ---------------------------------------------------------------------------
const _e = env.NEXT_PUBLIC_ENV
const _supabaseAliases = [
  {
    name:  'NEXT_PUBLIC_SUPABASE_URL',
    alias: _e === 'production' ? 'SUPABASE_PROD_URL'         : _e === 'test' ? 'SUPABASE_QA_URL'         : 'SUPABASE_DEV_URL',
  },
  {
    name:  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    alias: _e === 'production' ? 'SUPABASE_PROD_ANON_KEY'    : _e === 'test' ? 'SUPABASE_QA_ANON_KEY'    : 'SUPABASE_DEV_ANON_KEY',
  },
  {
    name:  'SUPABASE_SERVICE_ROLE_KEY',
    alias: _e === 'production' ? 'SUPABASE_PROD_SERVICE_KEY' : _e === 'test' ? 'SUPABASE_QA_SERVICE_KEY' : 'SUPABASE_DEV_SERVICE_KEY',
  },
]

// ---------------------------------------------------------------------------
// 1. REQUIRED — build/runtime will be broken without these
// ---------------------------------------------------------------------------
const REQUIRED = [
  // Note: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // and SUPABASE_SERVICE_ROLE_KEY are checked via _supabaseAliases above.
  'ANTHROPIC_API_KEY',
  'ENCRYPTION_KEY',
  'BREVO_API_KEY',    // Brevo (Sendinblue) transactional email
  'FROM_EMAIL',       // Sender address — must match a verified Brevo sender
  'ADMIN_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ENV',
]

// ---------------------------------------------------------------------------
// 2b. IMPORTANT — not strictly required but silently broken without them
// ---------------------------------------------------------------------------
const IMPORTANT = [
  { key: 'ADMIN_EMAIL',  msg: 'Admin daily digest and safety alert emails will be silently skipped.' },
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
  BREVO_API_KEY: {
    test: (v) => v.length >= 32,
    msg: 'Looks too short — paste the full key from Brevo → SMTP & API → API Keys',
  },
  FROM_EMAIL: {
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    msg: 'Must be a valid email address from a Resend-verified domain',
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

// Supabase vars — accept either generic name or env-specific alias
for (const { name, alias } of _supabaseAliases) {
  const value = env[name] ?? env[alias]
  if (!value) {
    console.error(`  ✗  MISSING: ${name} (or ${alias})`)
    errors++
  } else {
    const resolvedFrom = env[name] ? name : alias
    console.log(`  ✓  ${name} (resolved from ${resolvedFrom})`)
  }
}

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

// Important-but-not-blocking vars
for (const { key, msg } of IMPORTANT) {
  if (!env[key]) {
    console.warn(`  ⚠  MISSING (important): ${key} — ${msg}`)
    warnings++
  } else {
    console.log(`  ✓  ${key}`)
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
