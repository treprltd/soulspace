import { cookies } from 'next/headers'
import { verifyAdminToken } from './session'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export async function getAdminSecret(): Promise<string> {
  return process.env.ADMIN_SECRET ?? ''
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false

  // Break-glass: a legacy raw-secret cookie from a session that predates the
  // signed-token rollout (compliance finding #1). Kept so existing admins are
  // not logged out on deploy; remove once everyone uses per-person accounts.
  const secret = process.env.ADMIN_SECRET
  if (secret && token === secret) return true

  // Signed per-person / break-glass session token.
  return (await verifyAdminToken(token)) !== null
}

export async function setAdminCookie(res: Headers, secret: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${secret}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Strict${secure}`
  )
}

export async function clearAdminCookie(res: Headers) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`
  )
}
