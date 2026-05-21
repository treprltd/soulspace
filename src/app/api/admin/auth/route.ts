import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string }
  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 503 })
  }
  if (!password || password !== secret) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

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
