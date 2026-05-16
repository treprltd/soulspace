/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  },
}

export default nextConfig
