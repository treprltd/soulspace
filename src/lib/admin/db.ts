import { createClient } from '@supabase/supabase-js'

export type AdminEnv = 'dev' | 'qa' | 'prod'

// Returns a service-role Supabase client for the given environment.
// Each env has its own Supabase project with separate credentials.
export function getAdminClient(env: AdminEnv) {
  let url: string
  let serviceKey: string

  switch (env) {
    case 'dev':
      url = process.env.SUPABASE_DEV_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      serviceKey = process.env.SUPABASE_DEV_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
      break
    case 'qa':
      url = process.env.SUPABASE_QA_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      serviceKey = process.env.SUPABASE_QA_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
      break
    case 'prod':
      url = process.env.SUPABASE_PROD_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      serviceKey = process.env.SUPABASE_PROD_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
      break
  }

  if (!url || !serviceKey) {
    throw new Error(`Missing Supabase credentials for env: ${env}`)
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Detect which env this deployment is, to set the default tab in the UI.
export function getCurrentEnv(): AdminEnv {
  const e = process.env.NEXT_PUBLIC_ENV
  if (e === 'production') return 'prod'
  if (e === 'test') return 'qa'
  return 'dev'
}

// Human-readable labels and badge colors for each env
export const ENV_META: Record<AdminEnv, { label: string; color: string; bg: string }> = {
  dev:  { label: 'Dev',        color: '#3DAF96', bg: 'rgba(42,140,122,.15)' },
  qa:   { label: 'QA / Test',  color: '#C9A84C', bg: 'rgba(201,168,76,.15)' },
  prod: { label: 'Production', color: '#D44040', bg: 'rgba(212,64,64,.15)'  },
}
