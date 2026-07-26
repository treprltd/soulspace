import { NextRequest, NextResponse } from 'next/server'
import { getDefaultAdminEnv } from '@/lib/admin/env'
import { getAdminClientSafe } from '@/lib/admin/db'
import { logAdminAction, clientIp } from '@/lib/admin/audit'
import { signAdminToken } from '@/lib/admin/session'
import { verifyPassword, verifyTotp } from '@/lib/admin/accounts'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

function cookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   COOKIE_MAX_AGE,
    sameSite: 'strict' as const,
  }
}

async function issueSession(sub: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE
  const token = await signAdminToken({ sub, email, exp })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, cookieOptions())
  return res
}

interface AdminUserRow {
  id: string; email: string; password_hash: string
  totp_secret: string | null; mfa_enabled: boolean; disabled: boolean
}

export async function POST(req: NextRequest) {
  const { email, password, totp } = await req.json() as
    { email?: string; password?: string; totp?: string }
  const env = getDefaultAdminEnv()
  const ip  = clientIp(req)

  // ── Per-person account path ───────────────────────────────────────────────
  // Active once migration 021 is applied AND an account exists. Until then this
  // path finds no row and falls through to the break-glass path below, so
  // deploying this change locks nobody out.
  if (email) {
    const lookup = email.trim().toLowerCase()
    const svc = getAdminClientSafe(env)
    if (svc.ok) {
      let admin: AdminUserRow | null = null
      try {
        const { data } = await svc.db
          .from('admin_users')
          .select('id, email, password_hash, totp_secret, mfa_enabled, disabled')
          .eq('email', lookup)
          .maybeSingle()
        admin = (data as AdminUserRow | null) ?? null
      } catch {
        admin = null   // table missing (021 not applied) → treat as no account
      }

      if (admin && !admin.disabled && password && verifyPassword(password, admin.password_hash)) {
        if (admin.mfa_enabled) {
          if (!totp || !admin.totp_secret || !verifyTotp(admin.totp_secret, totp)) {
            void logAdminAction({ env, action: 'admin.login_mfa_failed', actor: admin.email, ip })
            return NextResponse.json({ error: 'Invalid authentication code', mfa_required: true }, { status: 401 })
          }
        }
        await svc.db.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', admin.id)
        void logAdminAction({ env, action: 'admin.login', actor: admin.email, ip })
        return issueSession(admin.id, admin.email)
      }
    }
    void logAdminAction({ env, action: 'admin.login_failed', actor: lookup, ip })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // ── Break-glass path (shared secret) ──────────────────────────────────────
  // Retained until per-person accounts are provisioned and proven, then removed
  // (see docs/admin-auth-rollout.md). The cookie is now a SIGNED token, not the
  // raw secret — the shared password never travels in the cookie.
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 })
  }
  if (!password || password !== secret) {
    void logAdminAction({ env, action: 'admin.login_failed', ip })
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }
  void logAdminAction({ env, action: 'admin.login', actor: 'break-glass', ip })
  return issueSession('break-glass', 'break-glass')
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
