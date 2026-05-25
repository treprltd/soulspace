import { createClient } from '@supabase/supabase-js'

export type AdminEnv = 'dev' | 'qa' | 'prod'

// Required env vars per environment — shown in the admin UI when missing.
const ENV_VARS: Record<AdminEnv, [string, string]> = {
  dev:  ['SUPABASE_DEV_URL',  'SUPABASE_DEV_SERVICE_KEY'],
  qa:   ['SUPABASE_QA_URL',   'SUPABASE_QA_SERVICE_KEY'],
  prod: ['SUPABASE_PROD_URL', 'SUPABASE_PROD_SERVICE_KEY'],
}

// Returns a service-role Supabase client for the given environment.
//
// IMPORTANT: dev and qa NEVER fall back to the current deployment's
// credentials. Without this guard, an unconfigured dev tab on the production
// deployment would silently query the production database, showing production
// data in the "Dev" column — which is exactly the bug we're fixing.
//
// prod falls back to NEXT_PUBLIC_* / SUPABASE_SERVICE_ROLE_KEY so the Prod
// tab works on the production deployment before explicit vars are set.
export function getAdminClient(env: AdminEnv) {
  let url: string | undefined
  let serviceKey: string | undefined

  switch (env) {
    case 'dev':
      url        = process.env.SUPABASE_DEV_URL
      serviceKey = process.env.SUPABASE_DEV_SERVICE_KEY
      break
    case 'qa':
      url        = process.env.SUPABASE_QA_URL
      serviceKey = process.env.SUPABASE_QA_SERVICE_KEY
      break
    case 'prod':
      // Safe fallback: on the prod deployment NEXT_PUBLIC_SUPABASE_URL IS prod.
      url        = process.env.SUPABASE_PROD_URL        ?? process.env.NEXT_PUBLIC_SUPABASE_URL
      serviceKey = process.env.SUPABASE_PROD_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
      break
  }

  if (!url || !serviceKey) {
    const [urlVar, keyVar] = ENV_VARS[env]
    throw new Error(
      `${env.toUpperCase()} not configured — add ${urlVar} and ${keyVar} ` +
      `to Amplify environment variables (all branches).`
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Safe wrapper — returns a discriminated union so TypeScript can narrow `db`
// after the configError guard without requiring non-null assertions.
//
//   const result = getAdminClientSafe(env)
//   if (!result.ok) return NextResponse.json({ error: result.error, not_configured: true }, { status: 503 })
//   const { db } = result  // ← db is guaranteed non-null here
//
export type AdminClientResult =
  | { ok: true;  db: ReturnType<typeof getAdminClient> }
  | { ok: false; error: string }

export function getAdminClientSafe(env: AdminEnv): AdminClientResult {
  try {
    return { ok: true, db: getAdminClient(env) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// Human-readable labels and badge colors for each env
export const ENV_META: Record<AdminEnv, { label: string; color: string; bg: string }> = {
  dev:  { label: 'Dev',        color: '#3DAF96', bg: 'rgba(42,140,122,.15)' },
  qa:   { label: 'QA / Test',  color: '#C9A84C', bg: 'rgba(201,168,76,.15)' },
  prod: { label: 'Production', color: '#D44040', bg: 'rgba(212,64,64,.15)'  },
}
