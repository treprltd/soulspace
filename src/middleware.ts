import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_session'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only guard /admin/* routes; let /admin/login through
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const secret = process.env.ADMIN_SECRET
    const token = req.cookies.get(COOKIE_NAME)?.value

    if (!secret || token !== secret) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
