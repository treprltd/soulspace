// Client-safe admin env utilities.
// Uses NEXT_PUBLIC_ENV (available in both server and browser bundles).
// Do NOT import db.ts (server-only) in client components.

export type AdminEnv = 'dev' | 'qa' | 'prod'

/**
 * Returns the env that matches the current deployment.
 * Used as the default tab in the admin panel so that:
 *   - Production deployment (soulspacehealth.org/admin) → opens "Prod" tab
 *   - Dev deployment → opens "Dev" tab
 *   - Test/QA deployment → opens "QA" tab
 */
export function getDefaultAdminEnv(): AdminEnv {
  const e = process.env.NEXT_PUBLIC_ENV
  if (e === 'production') return 'prod'
  if (e === 'test') return 'qa'
  return 'dev'
}
