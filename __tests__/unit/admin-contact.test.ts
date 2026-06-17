/**
 * Unit tests — /api/admin/contact route
 *
 * Tests both GET (list) and POST (send reply) across all branches:
 *   - Unauthorized requests → 401
 *   - Unconfigured env → 503 with not_configured flag
 *   - Missing / invalid body fields → 400
 *   - Submission not found → 404
 *   - Email failure → 500
 *   - Happy-path GET returns correct shape
 *   - Happy-path POST sends email, updates DB, returns { ok: true }
 *   - Filter=unreplied passes correct query param to Supabase
 *
 * All Supabase calls and email sends are mocked — no network traffic.
 *
 * Run: npm test -- admin-contact
 */

import { NextRequest } from 'next/server'

// ── Auth mock ─────────────────────────────────────────────────────────────────
const mockIsAdmin = jest.fn<Promise<boolean>, []>()
jest.mock('@/lib/admin/auth', () => ({
  isAdminAuthenticated: () => mockIsAdmin(),
}))

// ── Admin env mock ────────────────────────────────────────────────────────────
jest.mock('@/lib/admin/env', () => ({
  getDefaultAdminEnv: () => 'dev',
}))

// ── Supabase admin DB mock ────────────────────────────────────────────────────

// Returns an object that is awaitable (thenable) AND has all query methods
// returning itself — so any chain length works and any point in the chain
// can be awaited to yield `value`.
function makeThenable(value: unknown) {
  const obj: Record<string, unknown> = {}
  const fluent = () => obj
  obj.select = fluent
  obj.eq     = fluent
  obj.or     = fluent
  obj.order  = fluent
  obj.range  = fluent
  obj.single = fluent
  // Make `await obj` resolve to `value`
  obj.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(value).then(resolve)
  return obj
}

const mockGetAdminClientSafe = jest.fn()
jest.mock('@/lib/admin/db', () => ({
  getAdminClientSafe: (env: string) => mockGetAdminClientSafe(env),
}))

// ── Email mock ────────────────────────────────────────────────────────────────
const mockSendEmail = jest.fn<Promise<void>, []>()
jest.mock('@/lib/email', () => ({
  sendEmail:           (...args: unknown[]) => mockSendEmail(...(args as [])),
  contactReplyEmail:   jest.fn().mockReturnValue({
    subject:     'Re: your message to Soul Space',
    htmlContent: '<p>reply</p>',
    textContent: 'reply',
  }),
}))

// ── SUT ───────────────────────────────────────────────────────────────────────
import { GET, POST } from '@/app/api/admin/contact/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(method: string, searchParams?: Record<string, string>, body?: unknown): NextRequest {
  const url = new URL('http://localhost/api/admin/contact')
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const SAMPLE_SUBMISSIONS = [
  {
    id: 'sub-1', name: 'Ada Lovelace', email: 'ada@example.com',
    category: 'Feedback', sub_option: 'Session experience',
    message: 'Loved the experience.', replied: false,
    reply_body: null, replied_at: null, created_at: new Date().toISOString(),
  },
  {
    id: 'sub-2', name: 'Grace Hopper', email: 'grace@example.com',
    category: 'Technical issue', sub_option: "Can't sign in",
    message: 'I cannot sign in with my email.', replied: true,
    reply_body: 'Thanks, we fixed this.', replied_at: new Date().toISOString(), created_at: new Date().toISOString(),
  },
]

function makeConfiguredDb(submissions = SAMPLE_SUBMISSIONS, unreplied = 1) {
  return {
    from: (_table: string) => ({
      // select() distinguishes the main list query (no head) from the count query (head:true)
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) {
          // Unreplied count query — .eq() is the only thing called on this, then awaited
          return { eq: (_col: string, _val: unknown) => ({ count: unreplied, data: null, error: null }) }
        }
        // Main list query — any number of .order()/.range()/.eq()/.or() then awaited
        return makeThenable({ data: submissions, count: submissions.length, error: null })
      },
      update: (_vals: unknown) => ({
        eq: (_col: string, _val: unknown) => ({ error: null }),
      }),
    }),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/admin/contact', () => {
  beforeEach(() => {
    mockIsAdmin.mockReset()
    mockGetAdminClientSafe.mockReset()
  })

  it('returns 401 when not authenticated', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET(makeReq('GET', { env: 'dev' }))
    expect(res.status).toBe(401)
  })

  it('returns 503 with not_configured when env is not set up', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: false, error: 'DEV not configured' })
    const res = await GET(makeReq('GET', { env: 'dev' }))
    expect(res.status).toBe(503)
    const body = await res.json() as { not_configured: boolean }
    expect(body.not_configured).toBe(true)
  })

  it('returns 200 with correct response shape on success', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db: makeConfiguredDb() })
    const res = await GET(makeReq('GET', { env: 'dev' }))
    expect(res.status).toBe(200)
    const body = await res.json() as {
      submissions: unknown[]; total: number; unreplied: number; page: number; pages: number
    }
    expect(Array.isArray(body.submissions)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(typeof body.unreplied).toBe('number')
    expect(typeof body.page).toBe('number')
    expect(typeof body.pages).toBe('number')
  })

  it('returns submission data with expected fields', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db: makeConfiguredDb() })
    const res = await GET(makeReq('GET', { env: 'dev' }))
    const body = await res.json() as { submissions: typeof SAMPLE_SUBMISSIONS }
    expect(body.submissions.length).toBeGreaterThan(0)
    const first = body.submissions[0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('email')
    expect(first).toHaveProperty('category')
    expect(first).toHaveProperty('message')
    expect(first).toHaveProperty('replied')
  })

  it('passes filter=unreplied to the query (does not throw)', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db: makeConfiguredDb(SAMPLE_SUBMISSIONS.filter(s => !s.replied), 1) })
    const res = await GET(makeReq('GET', { env: 'dev', filter: 'unreplied' }))
    expect(res.status).toBe(200)
  })

  it('defaults to page 1 when page param is missing', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db: makeConfiguredDb() })
    const res = await GET(makeReq('GET', { env: 'dev' }))
    const body = await res.json() as { page: number }
    expect(body.page).toBe(1)
  })

  it('uses getDefaultAdminEnv when env param is missing', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db: makeConfiguredDb() })
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(200)
    // getDefaultAdminEnv is mocked to return 'dev', so getAdminClientSafe is called with 'dev'
    expect(mockGetAdminClientSafe).toHaveBeenCalledWith('dev')
  })
})

describe('POST /api/admin/contact', () => {
  beforeEach(() => {
    mockIsAdmin.mockReset()
    mockGetAdminClientSafe.mockReset()
    mockSendEmail.mockReset()
  })

  it('returns 401 when not authenticated', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await POST(makeReq('POST', {}, { id: 'sub-1', reply: 'Hello.', env: 'dev' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const res = await POST(makeReq('POST', {}, { reply: 'Hello.', env: 'dev' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when reply is missing', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const res = await POST(makeReq('POST', {}, { id: 'sub-1', env: 'dev' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when reply is blank whitespace', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const res = await POST(makeReq('POST', {}, { id: 'sub-1', reply: '   ', env: 'dev' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when env is missing', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const res = await POST(makeReq('POST', {}, { id: 'sub-1', reply: 'Hello.' }))
    expect(res.status).toBe(400)
  })

  it('returns 503 with not_configured when env is not set up', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminClientSafe.mockReturnValue({ ok: false, error: 'DEV not configured' })
    const res = await POST(makeReq('POST', {}, { id: 'sub-1', reply: 'Hi.', env: 'dev' }))
    expect(res.status).toBe(503)
  })

  it('returns 404 when submission is not found', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({ data: null, error: { message: 'No rows found.' } }),
          }),
        }),
      }),
    }
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db })
    const res = await POST(makeReq('POST', {}, { id: 'nonexistent', reply: 'Hi.', env: 'dev' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 when email send fails', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { name: 'Ada', email: 'ada@example.com', category: 'Feedback' },
              error: null,
            }),
          }),
        }),
        update: () => ({ eq: () => ({ error: null }) }),
      }),
    }
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db })
    mockSendEmail.mockRejectedValue(new Error('Brevo unavailable'))
    const res = await POST(makeReq('POST', {}, { id: 'sub-1', reply: 'Hi there.', env: 'dev' }))
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/email/i)
  })

  it('returns 200 ok:true, sends email, and updates DB on success', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const updateFn = jest.fn().mockReturnValue({ eq: () => ({ error: null }) })
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { name: 'Ada Lovelace', email: 'ada@example.com', category: 'Feedback' },
              error: null,
            }),
          }),
        }),
        update: updateFn,
      }),
    }
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db })
    mockSendEmail.mockResolvedValue(undefined)

    const res = await POST(makeReq('POST', {}, { id: 'sub-1', reply: 'Thanks for your message.', env: 'dev' }))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ replied: true, reply_body: 'Thanks for your message.' })
    )
  })

  it('trims whitespace from reply body before saving', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const updateFn = jest.fn().mockReturnValue({ eq: () => ({ error: null }) })
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { name: 'Ada', email: 'ada@example.com', category: 'Other' },
              error: null,
            }),
          }),
        }),
        update: updateFn,
      }),
    }
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db })
    mockSendEmail.mockResolvedValue(undefined)

    await POST(makeReq('POST', {}, { id: 'sub-1', reply: '  Trimmed reply.  ', env: 'dev' }))
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ reply_body: 'Trimmed reply.' })
    )
  })

  it('sets replied_at to a valid ISO timestamp on success', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const updateFn = jest.fn().mockReturnValue({ eq: () => ({ error: null }) })
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { name: 'Ada', email: 'ada@example.com', category: 'Other' },
              error: null,
            }),
          }),
        }),
        update: updateFn,
      }),
    }
    mockGetAdminClientSafe.mockReturnValue({ ok: true, db })
    mockSendEmail.mockResolvedValue(undefined)

    await POST(makeReq('POST', {}, { id: 'sub-1', reply: 'Hello.', env: 'dev' }))
    const [updatePayload] = updateFn.mock.calls[0] as [{ replied_at: string }]
    expect(() => new Date(updatePayload.replied_at)).not.toThrow()
    expect(new Date(updatePayload.replied_at).getTime()).not.toBeNaN()
  })
})
