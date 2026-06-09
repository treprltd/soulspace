'use client'

/**
 * AdminEnvNotConfigured — shown in admin pages when the environment-specific
 * Supabase credentials haven't been set in Amplify. Replaces the generic red
 * "Error: …" with a clear setup guide so the operator knows exactly what to do.
 */

import type { AdminEnv } from '@/lib/admin/env'

const ENV_VARS: Record<AdminEnv, { url: string; key: string }> = {
  dev:  { url: 'SUPABASE_DEV_URL',  key: 'SUPABASE_DEV_SERVICE_KEY'  },
  qa:   { url: 'SUPABASE_QA_URL',   key: 'SUPABASE_QA_SERVICE_KEY'   },
  prod: { url: 'SUPABASE_PROD_URL', key: 'SUPABASE_PROD_SERVICE_KEY' },
}

export function AdminEnvNotConfigured({ env }: { env: AdminEnv }) {
  const vars = ENV_VARS[env]

  return (
    <div style={{
      marginTop: '16px',
      padding: '24px 28px',
      background: 'rgba(201,168,76,.05)',
      border: '1px solid rgba(201,168,76,.25)',
      borderRadius: 'var(--r-lg)',
      maxWidth: '560px',
    }}>
      <div style={{
        fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--gold)', marginBottom: '10px', fontWeight: 600,
      }}>
        {env.toUpperCase()} environment not configured
      </div>

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mist)', lineHeight: 1.65, marginBottom: '16px' }}>
        The <strong style={{ color: 'var(--sand)' }}>{env.toUpperCase()}</strong> tab requires
        its own Supabase credentials so the admin panel can connect to the correct project.
        Without these, it would silently query the wrong database.
      </p>

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mist)', lineHeight: 1.65, marginBottom: '14px' }}>
        Add these two variables to <strong style={{ color: 'var(--sand)' }}>all branches</strong> in{' '}
        <strong style={{ color: 'var(--sand)' }}>AWS Amplify → App settings → Environment variables</strong>:
      </p>

      <div style={{
        padding: '12px 16px',
        background: 'rgba(6,14,24,.6)',
        borderRadius: 'var(--r-md)',
        border: '1px solid rgba(245,237,216,.07)',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: 'var(--sand)',
        lineHeight: 2,
      }}>
        <div>
          <span style={{ color: 'var(--mist)' }}># URL of the {env.toUpperCase()} Supabase project</span>
        </div>
        <div>{vars.url}=https://YOUR_{env.toUpperCase()}_REF.supabase.co</div>
        <div style={{ marginTop: '4px' }}>
          <span style={{ color: 'var(--mist)' }}># Service-role key (Settings → API)</span>
        </div>
        <div>{vars.key}=your_service_role_key</div>
      </div>

      <p style={{ marginTop: '14px', fontSize: '11px', color: 'rgba(213,226,235,.72)', lineHeight: 1.6 }}>
        Copy both values from the Supabase dashboard:{' '}
        <strong style={{ color: 'rgba(139,167,184,.7)' }}>Project Settings → API</strong>.
        Redeploy after saving.
      </p>
    </div>
  )
}
