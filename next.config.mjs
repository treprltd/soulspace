import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */

// ---------------------------------------------------------------------------
// Security headers — applied to every route.
// CSP allows Supabase realtime (wss), Anthropic API, and Brevo SMTP origin;
// everything else is locked to self. Inline scripts/styles are needed by
// Next.js for hydration and Tailwind-generated styles.
// ---------------------------------------------------------------------------
const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Strict-Transport-Security',
    // 2 years, include sub-domains, pre-load list eligible
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requires inline scripts for hydration and route transitions
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind JIT / Next.js emotion-style injects inline styles
      "style-src 'self' 'unsafe-inline'",
      // next/image optimised images, data URIs, blob previews
      "img-src 'self' data: blob: https:",
      // Self-hosted fonts via next/font (no external font CDN needed)
      "font-src 'self' data:",
      // API connections: Supabase REST + realtime WS, Anthropic, Brevo, Sentry
      [
        "connect-src 'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://api.anthropic.com',
        'https://api.brevo.com',
        'https://api.stripe.com',
        'https://*.sentry.io',
        'https://*.ingest.sentry.io',
        'https://*.ingest.us.sentry.io',
        'https://*.ingest.de.sentry.io',
      ].join(' '),
      // Stripe hosted checkout iframe
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // Stripe.js loaded in checkout page
      "script-src-elem 'self' 'unsafe-inline' https://js.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply to every route (pages, API routes, static assets)
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  // Embed server-side secrets at build time so they are available in the
  // SSR Lambda runtime on Amplify Gen 1 (branch env vars are only available
  // during the build phase, not injected into the Lambda at runtime).
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_ESSENTIALS_PRICE_ID: process.env.STRIPE_ESSENTIALS_PRICE_ID,
    STRIPE_INSIGHTS_PRICE_ID: process.env.STRIPE_INSIGHTS_PRICE_ID,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    // Admin panel — was missing; Amplify Gen 1 does not inject env vars into
    // Lambda at runtime so every server-only secret must be listed here.
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    // Admin multi-env Supabase clients (dev / qa / prod projects)
    SUPABASE_DEV_URL: process.env.SUPABASE_DEV_URL,
    SUPABASE_DEV_SERVICE_KEY: process.env.SUPABASE_DEV_SERVICE_KEY,
    SUPABASE_QA_URL: process.env.SUPABASE_QA_URL,
    SUPABASE_QA_SERVICE_KEY: process.env.SUPABASE_QA_SERVICE_KEY,
    SUPABASE_PROD_URL: process.env.SUPABASE_PROD_URL,
    SUPABASE_PROD_SERVICE_KEY: process.env.SUPABASE_PROD_SERVICE_KEY,
    // Rate limiting — Upstash Redis (optional; skipped when absent)
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    // Sentry DSN is NEXT_PUBLIC_ so it reaches the client bundle (safe — read-only ingest key)
    // SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT are build-time only; not needed at runtime.
  },
}

// ---------------------------------------------------------------------------
// Sentry — wraps the Next.js config to inject source maps and performance
// monitoring. Tree-shaken in local dev (SENTRY_DSN absent → no-op).
// ---------------------------------------------------------------------------
export default withSentryConfig(nextConfig, {
  // Sentry organisation and project (set in Amplify env vars for prod)
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source-map upload during build
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Don't block the build if Sentry token is missing (local dev)
  silent: true,

  // Upload source maps to Sentry and delete them from the deploy artifact
  // so they are never publicly accessible.
  hideSourceMaps: true,

  // Disable automatic instrumentation of Vercel Cron — not relevant on Amplify
  webpack: {
    automaticVercelMonitors: false,
  },
})
