import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export async function getAdminSecret(): Promise<string> {
  return process.env.ADMIN_SECRET ?? ''
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = await getAdminSecret()
  if (!secret) return false
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return token === secret
}

export async function setAdminCookie(res: Headers, secret: string) {
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${secret}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Strict`
  )
}

export async function clearAdminCookie(res: Headers) {
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`
  )
}
