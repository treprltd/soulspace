import { NextResponse } from 'next/server'

// Soul Space icon — served as SVG, no @vercel/og needed (works on all platforms)
// favicon.ico/route.ts redirects here; layout metadata also references /icon
export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#060E18"/>
  <text x="16" y="23" text-anchor="middle" font-size="18" fill="#C9A84C" font-family="serif">&#9678;</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
