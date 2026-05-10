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
  },
}

export default nextConfig
