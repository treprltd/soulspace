import { NextRequest, NextResponse } from 'next/server'

// Legacy server-side callback — forwards to the client-side callback page
// which handles PKCE code exchange in the browser (avoids third-party cookie issues).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = forwardedHost ?? req.headers.get('host') ?? ''
  const origin = `${forwardedProto}://${host}`

  // Forward all params to the client-side callback page
  const params = new URLSearchParams()
  searchParams.forEach((value, key) => params.set(key, value))

  return NextResponse.redirect(`${origin}/auth/callback?${params.toString()}`)
}
