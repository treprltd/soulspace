import { NextRequest, NextResponse } from 'next/server'
import { getDefaultAdminEnv } from '@/lib/admin/env'
import { logAdminAction, clientIp } from '@/lib/admin/audit'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string }
  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 })
  }
  if (!password || password !== secret) {
    // Audit failed attempts too — brute-force / credential-stuffing signal.
    void logAdminAction({ env: getDefaultAdminEnv(), action: 'admin.login_failed', ip: clientIp(req) })
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  void logAdminAction({ env: getDefaultAdminEnv(), action: 'admin.login', ip: clientIp(req) })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'strict',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
