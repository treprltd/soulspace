import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Rate limiting via Upstash Redis + @upstash/ratelimit
//
// Required env vars (add to Amplify + .env.local):
//   UPSTASH_REDIS_REST_URL   — from Upstash console → Redis → REST URL
//   UPSTASH_REDIS_REST_TOKEN — from Upstash console → Redis → REST token
//
// When the env vars are absent (local dev without Redis), rate limiting is
// skipped silently so development is never blocked.
// ---------------------------------------------------------------------------

let rateLimiters: {
  mirror: import('@upstash/ratelimit').Ratelimit
  sessions: import('@upstash/ratelimit').Ratelimit
  admin: import('@upstash/ratelimit').Ratelimit
  global: import('@upstash/ratelimit').Ratelimit
} | null = null

async function getRateLimiters() {
  if (rateLimiters) return rateLimiters
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const { Redis }      = await import('@upstash/redis')
  const { Ratelimit }  = await import('@upstash/ratelimit')
  const redis = new Redis({ url, token })

  rateLimiters = {
    // Mirror: expensive — 10 requests / user / hour
    mirror: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix: 'rl:mirror',
      analytics: false,
    }),
    // Sessions: 30 / user / hour
    sessions: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      prefix: 'rl:sessions',
      analytics: false,
    }),
    // Admin: 60 / IP / minute
    admin: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:admin',
      analytics: false,
    }),
    // Global catch-all: 200 / IP / minute
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, '1 m'),
      prefix: 'rl:global',
      analytics: false,
    }),
  }
  return rateLimiters
}

// Extract the best available identifier for rate-limit keying.
// Prefer authenticated user ID from the Authorization header JWT claim;
// fall back to the real client IP (respecting Cloudfront / ALB headers).
function getIdentifier(req: NextRequest): string {
  // Try to get user ID from Authorization bearer JWT (without full verification —
  // we only need the sub claim for bucketing, not security)
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = auth.split('.')[1]
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
        if (decoded?.sub) return `user:${decoded.sub}`
      }
    } catch {
      // fall through to IP
    }
  }

  // AWS ALB / CloudFront → X-Forwarded-For; Amplify sets this
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return `ip:${xff.split(',')[0].trim()}`

  return `ip:${req.ip ?? 'unknown'}`
}

function rateLimitResponse(retryAfter: number): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(retryAfter)),
        'X-RateLimit-Limit': '10',
      },
    },
  )
}

const ADMIN_COOKIE = 'admin_session'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ------------------------------------------------------------------
  // 1. Age gate enforcement — /session/* requires ss_age_ok cookie.
  //    Without it, redirect to /age-gate so the user self-declares age.
  //    This prevents direct-URL bypass of the age gate.
  // ------------------------------------------------------------------
  if (pathname.startsWith('/session')) {
    const ageOk = req.cookies.get('ss_age_ok')?.value
    if (!ageOk || !['teen', 'adult'].includes(ageOk)) {
      const ageGateUrl = req.nextUrl.clone()
      ageGateUrl.pathname = '/age-gate'
      return NextResponse.redirect(ageGateUrl)
    }
  }

  // ------------------------------------------------------------------
  // 2. Admin route protection (unchanged from before)
  // ------------------------------------------------------------------
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const secret = process.env.ADMIN_SECRET
    const token  = req.cookies.get(ADMIN_COOKIE)?.value

    if (!secret || token !== secret) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ------------------------------------------------------------------
  // 3. Rate limiting (skipped if Upstash is not configured)
  // ------------------------------------------------------------------
  const limiters = await getRateLimiters().catch(() => null)
  if (limiters) {
    const id = getIdentifier(req)

    // Stripe webhooks: never rate-limit — Stripe signature verification
    // handles authenticity; retries must not be blocked.
    if (pathname === '/api/stripe/webhook') {
      return NextResponse.next()
    }

    // Mirror endpoint — strictest limit
    if (pathname === '/api/mirror') {
      const { success, reset } = await limiters.mirror.limit(id)
      if (!success) return rateLimitResponse(reset / 1000 - Date.now() / 1000)
    }

    // Sessions endpoint
    else if (pathname.startsWith('/api/sessions')) {
      const { success, reset } = await limiters.sessions.limit(id)
      if (!success) return rateLimitResponse(reset / 1000 - Date.now() / 1000)
    }

    // Admin API routes
    else if (pathname.startsWith('/api/admin')) {
      const ipId = `ip:${req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.ip ?? 'unknown'}`
      const { success, reset } = await limiters.admin.limit(ipId)
      if (!success) return rateLimitResponse(reset / 1000 - Date.now() / 1000)
    }

    // Global catch-all for all other API routes
    else if (pathname.startsWith('/api/')) {
      const { success, reset } = await limiters.global.limit(id)
      if (!success) return rateLimitResponse(reset / 1000 - Date.now() / 1000)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run middleware on session flow pages, admin pages, and all API routes.
  // Static files (_next/static, images, favicon) are excluded automatically.
  matcher: ['/session/:path*', '/admin/:path*', '/api/:path*'],
}
