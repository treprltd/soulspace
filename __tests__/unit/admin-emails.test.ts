/**
 * Unit tests — /api/admin/emails route
 *
 * Covers:
 *   - Auth gate (401 when not authenticated)
 *   - Missing BREVO_API_KEY → 503 with not_configured
 *   - Brevo events API failure → 502
 *   - Happy path: correct response shape (quota, stats, emails, total)
 *   - Quota calculation (usedToday, remaining, pct)
 *   - 7-day stats aggregation (sent, delivered, opens, bounces, spam, blocked)
 *   - Open rate and delivery rate math
 *   - Falls back to FREE_DAILY_LIMIT=300 when account fetch fails
 *   - Default limit (50) and offset (0)
 *   - Custom limit/offset forwarded
 *   - Cap limit at 100
 *   - Empty emails array when events is absent
 *   - Events grouped by messageId → correct email count
 *   - Network error → 500 with error message
 *   - stats.window / startDate / endDate fields present
 *
 * No network traffic — global fetch is mocked.
 *
 * Run: npm test -- admin-emails
 */

import { NextRequest } from 'next/server'

// ── Auth mock ──────────────────────────────────────────────────────────────────
const mockIsAdmin = jest.fn<Promise<boolean>, []>()
jest.mock('@/lib/admin/auth', () => ({
  isAdminAuthenticated: () => mockIsAdmin(),
}))

// ── Env mock ───────────────────────────────────────────────────────────────────
const FAKE_KEY = 'xkeysib-test-key-12345'

// ── global fetch mock ─────────────────────────────────────────────────────────
const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
global.fetch = mockFetch as typeof fetch

// ── SUT ───────────────────────────────────────────────────────────────────────
import { GET } from '@/app/api/admin/emails/route'

// ── Sample Brevo payloads ──────────────────────────────────────────────────────
const SAMPLE_ACCOUNT = {
  email: 'founder@soulspacehealth.com',
  plan: [{ type: 'free', creditsType: 'sendingLimit', credits: 300 }],
}

function makeReport(overrides: Partial<{
  requests: number; delivered: number; opens: number
  hardBounces: number; softBounces: number; spamReports: number; blocked: number
}> = {}) {
  return {
    date: '2026-06-17',
    requests:    overrides.requests    ?? 10,
    delivered:   overrides.delivered   ?? 9,
    hardBounces: overrides.hardBounces ?? 0,
    softBounces: overrides.softBounces ?? 0,
    opens:       overrides.opens       ?? 3,
    uniqueOpens: overrides.opens       ?? 3,
    clicks:      0, uniqueClicks: 0,
    spamReports: overrides.spamReports ?? 0,
    blocked:     overrides.blocked     ?? 0,
    invalid: 0, unsubscribed: 0,
  }
}

// Raw Brevo events from /smtp/statistics/events — one record per event, not per email
const SAMPLE_EVENTS = [
  // Email 1: poojasingh → 2 events (request + delivered)
  {
    email: 'poojasingh3462@gmail.com', date: '2026-06-17T10:00:00.000Z',
    messageId: '<abc123@brevo.com>',
    subject: "You said you'd be open to trying Soul Space",
    event: 'requests', reason: '', tag: '',
    from: 'Soul Space <noreply@soulspacehealth.org>', templateId: null,
  },
  {
    email: 'poojasingh3462@gmail.com', date: '2026-06-17T10:00:05.000Z',
    messageId: '<abc123@brevo.com>',
    subject: "You said you'd be open to trying Soul Space",
    event: 'delivered', reason: '', tag: '',
    from: 'Soul Space <noreply@soulspacehealth.org>', templateId: null,
  },
  // Email 2: sukanyakbabu → 3 events (request + delivered + opened)
  {
    email: 'sukanyakbabu@gmail.com', date: '2026-06-17T10:00:01.000Z',
    messageId: '<def456@brevo.com>',
    subject: "You said you'd be open to trying Soul Space",
    event: 'requests', reason: '', tag: '',
    from: 'Soul Space <noreply@soulspacehealth.org>', templateId: null,
  },
  {
    email: 'sukanyakbabu@gmail.com', date: '2026-06-17T10:00:06.000Z',
    messageId: '<def456@brevo.com>',
    subject: "You said you'd be open to trying Soul Space",
    event: 'delivered', reason: '', tag: '',
    from: 'Soul Space <noreply@soulspacehealth.org>', templateId: null,
  },
  {
    email: 'sukanyakbabu@gmail.com', date: '2026-06-17T10:05:00.000Z',
    messageId: '<def456@brevo.com>',
    subject: "You said you'd be open to trying Soul Space",
    event: 'opened', reason: '', tag: '',
    from: 'Soul Space <noreply@soulspacehealth.org>', templateId: null,
  },
]

// 5 events → 2 unique emails after grouping by messageId
const EXPECTED_EMAIL_COUNT = 2

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }) as Response
}

function makeReq(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/admin/emails')
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: 'GET' })
}

function setupHappyFetch(overrides: {
  accountStatus?: number
  todayReports?:  ReturnType<typeof makeReport>[]
  weekReports?:   ReturnType<typeof makeReport>[]
  events?:        typeof SAMPLE_EVENTS
  eventsStatus?:  number
} = {}) {
  const todayRpt  = overrides.todayReports  ?? [makeReport({ requests: 27, delivered: 25, opens: 5 })]
  const weekRpts  = overrides.weekReports   ?? [makeReport({ requests: 10 }), makeReport({ requests: 10 })]
  const events    = overrides.events        ?? SAMPLE_EVENTS
  const acctOk    = (overrides.accountStatus ?? 200) === 200
  const evtStatus = overrides.eventsStatus  ?? 200

  const todayStr = new Date().toISOString().slice(0, 10)

  mockFetch.mockImplementation((input) => {
    const url = typeof input === 'string' ? input : (input as URL).toString()
    if (url.includes('/account'))
      return Promise.resolve(jsonRes(acctOk ? SAMPLE_ACCOUNT : {}, overrides.accountStatus ?? 200))
    if (url.includes('smtp/statistics/events'))
      return Promise.resolve(jsonRes({ events }, evtStatus))
    if (url.includes('smtp/statistics/reports')) {
      const u     = new URL(url)
      const start = u.searchParams.get('startDate') ?? ''
      const isToday = start === todayStr
      return Promise.resolve(jsonRes({ reports: isToday ? todayRpt : weekRpts }))
    }
    return Promise.resolve(jsonRes({ error: 'Unknown endpoint' }, 404))
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/admin/emails', () => {
  const originalEnv = process.env.BREVO_API_KEY

  beforeEach(() => {
    mockIsAdmin.mockReset()
    mockFetch.mockReset()
    process.env.BREVO_API_KEY = FAKE_KEY
  })

  afterEach(() => {
    process.env.BREVO_API_KEY = originalEnv
  })

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/unauthorized/i)
  })

  // ── Config guard ───────────────────────────────────────────────────────────

  it('returns 503 with not_configured when BREVO_API_KEY is absent', async () => {
    mockIsAdmin.mockResolvedValue(true)
    delete process.env.BREVO_API_KEY

    const res = await GET(makeReq())
    expect(res.status).toBe(503)
    const body = await res.json() as { not_configured: boolean }
    expect(body.not_configured).toBe(true)
  })

  // ── Brevo API failures ─────────────────────────────────────────────────────

  it('returns 502 when Brevo events API fails', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch({ eventsStatus: 429 })
    const res = await GET(makeReq())
    expect(res.status).toBe(502)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/brevo events error/i)
  })

  it('returns 500 when fetch throws a network error', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFetch.mockRejectedValue(new Error('Network failure'))
    const res = await GET(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/network failure/i)
  })

  // ── Happy path: shape ──────────────────────────────────────────────────────

  it('returns correct top-level shape on success', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch()

    const res = await GET(makeReq())
    expect(res.status).toBe(200)

    const body = await res.json() as {
      quota: object; stats: object; emails: unknown[]; total: number; limit: number; offset: number
    }
    expect(body).toHaveProperty('quota')
    expect(body).toHaveProperty('stats')
    expect(body).toHaveProperty('emails')
    expect(typeof body.total).toBe('number')
    expect(typeof body.limit).toBe('number')
    expect(typeof body.offset).toBe('number')
  })

  it('groups events by messageId into per-email rows', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch()

    const res = await GET(makeReq())
    const body = await res.json() as { emails: { email: string; events: { name: string }[] }[]; total: number }

    // 5 raw events → 2 unique emails
    expect(body.emails).toHaveLength(EXPECTED_EMAIL_COUNT)
    expect(body.total).toBe(EXPECTED_EMAIL_COUNT)
    expect(body.emails[0]).toHaveProperty('email')
    expect(body.emails[0]).toHaveProperty('subject')
    expect(Array.isArray(body.emails[0].events)).toBe(true)
    // Events are preserved per email
    expect(body.emails[0].events.length).toBeGreaterThanOrEqual(1)
  })

  // ── Quota calculation ──────────────────────────────────────────────────────

  it('computes quota correctly from todays report and account plan', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch({ todayReports: [makeReport({ requests: 27 })] })

    const res  = await GET(makeReq())
    const body = await res.json() as { quota: { daily: number; usedToday: number; remaining: number; pct: number } }

    expect(body.quota.daily).toBe(300)
    expect(body.quota.usedToday).toBe(27)
    expect(body.quota.remaining).toBe(273)
    expect(body.quota.pct).toBe(9)
  })

  it('falls back to FREE_DAILY_LIMIT=300 when account fetch fails', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch({ accountStatus: 500 })

    const res  = await GET(makeReq())
    const body = await res.json() as { quota: { daily: number } }
    expect(body.quota.daily).toBe(300)
  })

  it('clamps remaining to 0 when usedToday exceeds daily limit', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch({ todayReports: [makeReport({ requests: 350 })] })

    const res  = await GET(makeReq())
    const body = await res.json() as { quota: { remaining: number } }
    expect(body.quota.remaining).toBe(0)
  })

  // ── 7-day stats aggregation ────────────────────────────────────────────────

  it('aggregates 7-day reports correctly', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch({
      weekReports: [
        makeReport({ requests: 10, delivered: 9, opens: 3, hardBounces: 1 }),
        makeReport({ requests: 17, delivered: 17, opens: 4, softBounces: 1, spamReports: 1 }),
      ],
    })

    const res  = await GET(makeReq())
    const body = await res.json() as {
      stats: { sent: number; delivered: number; opens: number; bounces: number; spam: number }
    }

    expect(body.stats.sent).toBe(27)
    expect(body.stats.delivered).toBe(26)
    expect(body.stats.opens).toBe(7)
    expect(body.stats.bounces).toBe(2)
    expect(body.stats.spam).toBe(1)
  })

  it('returns 0 stats when no week reports are available', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch({ weekReports: [] })

    const res  = await GET(makeReq())
    const body = await res.json() as {
      stats: { sent: number; openRate: null; deliveryRate: null }
    }
    expect(body.stats.sent).toBe(0)
    expect(body.stats.openRate).toBeNull()
    expect(body.stats.deliveryRate).toBeNull()
  })

  // ── Rate calculations ──────────────────────────────────────────────────────

  it('calculates open rate correctly (1 decimal)', async () => {
    mockIsAdmin.mockResolvedValue(true)
    // 7 opens from 27 sent = 25.9%
    setupHappyFetch({
      weekReports: [makeReport({ requests: 27, opens: 7 })],
    })

    const res  = await GET(makeReq())
    const body = await res.json() as { stats: { openRate: number } }
    expect(body.stats.openRate).toBe(25.9)
  })

  it('calculates delivery rate correctly (1 decimal)', async () => {
    mockIsAdmin.mockResolvedValue(true)
    // 25 delivered from 27 sent = 92.6%
    setupHappyFetch({
      weekReports: [makeReport({ requests: 27, delivered: 25 })],
    })

    const res  = await GET(makeReq())
    const body = await res.json() as { stats: { deliveryRate: number } }
    expect(body.stats.deliveryRate).toBe(92.6)
  })

  // ── Pagination ─────────────────────────────────────────────────────────────

  it('defaults to limit=50 offset=0', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch()

    const res  = await GET(makeReq())
    const body = await res.json() as { limit: number; offset: number }
    expect(body.limit).toBe(50)
    expect(body.offset).toBe(0)
  })

  it('forwards custom limit and offset', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch()

    const res  = await GET(makeReq({ limit: '25', offset: '50' }))
    const body = await res.json() as { limit: number; offset: number }
    expect(body.limit).toBe(25)
    expect(body.offset).toBe(50)
  })

  it('caps limit at 100', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch()

    const res  = await GET(makeReq({ limit: '999' }))
    const body = await res.json() as { limit: number }
    expect(body.limit).toBe(100)
  })

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('returns empty emails array when events is absent', async () => {
    mockIsAdmin.mockResolvedValue(true)

    const todayStr = new Date().toISOString().slice(0, 10)
    mockFetch.mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as URL).toString()
      if (url.includes('/account'))               return Promise.resolve(jsonRes(SAMPLE_ACCOUNT))
      if (url.includes('smtp/statistics/events')) return Promise.resolve(jsonRes({}))
      if (url.includes('smtp/statistics/reports')) {
        const u = new URL(url)
        const isToday = u.searchParams.get('startDate') === todayStr
        return Promise.resolve(jsonRes({ reports: isToday ? [makeReport()] : [] }))
      }
      return Promise.resolve(jsonRes({}, 404))
    })

    const res  = await GET(makeReq())
    const body = await res.json() as { emails: unknown[] }
    expect(Array.isArray(body.emails)).toBe(true)
    expect(body.emails).toHaveLength(0)
  })

  it('includes window, startDate, endDate in stats object', async () => {
    mockIsAdmin.mockResolvedValue(true)
    setupHappyFetch()

    const res  = await GET(makeReq())
    const body = await res.json() as { stats: { window: string; startDate: string; endDate: string } }
    expect(body.stats.window).toBe('7d')
    expect(typeof body.stats.startDate).toBe('string')
    expect(typeof body.stats.endDate).toBe('string')
    expect(body.stats.endDate).toBe(new Date().toISOString().slice(0, 10))
  })
})
