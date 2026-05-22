import { NextResponse } from 'next/server'

// Redirect /favicon.ico → the Next.js-generated icon so browsers that
// request the legacy path directly don't get a 404.
export function GET(request: Request) {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(new URL('/icon', origin), { status: 301 })
}
