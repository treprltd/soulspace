/**
 * Unit tests — /api/contact route validation
 *
 * Tests all server-side validation branches:
 *   - Missing/invalid name
 *   - Missing/invalid email
 *   - Missing/invalid category
 *   - Missing subOption when the selected category requires one
 *   - subOption present for a no-sub-option category (ignored gracefully)
 *   - Message too short / too long
 *   - Successful submission (email calls mocked)
 *
 * Run: npm test -- contact-api
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/contact/route'

// ── Mock email lib ──────────────────────────────────────────────────────────
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({}),
  contactNotificationEmail: jest.fn().mockReturnValue({
    subject: '[Contact] test',
    htmlContent: '<p>notification</p>',
    textContent: 'notification',
  }),
  contactAckEmail: jest.fn().mockReturnValue({
    subject: 'We received your message',
    htmlContent: '<p>ack</p>',
    textContent: 'ack',
  }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BASE = {
  name:      'Ada Lovelace',
  email:     'ada@example.com',
  category:  'Feedback',      // no subOption required for this category in the route
  subOption: '',
  message:   'This is a test message that meets the minimum length requirement.',
}

const VALID_WITH_SUB = {
  name:      'Ada Lovelace',
  email:     'ada@example.com',
  category:  'Subscription',
  subOption: 'Refund request',
  message:   'I would like a refund for my subscription please.',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/contact — validation', () => {

  describe('name validation', () => {
    it('returns 422 when name is missing', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, name: '' }))
      expect(res.status).toBe(422)
      const body = await res.json() as { error: string }
      expect(body.error).toMatch(/name/i)
    })

    it('returns 422 when name is only whitespace', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, name: '   ' }))
      expect(res.status).toBe(422)
    })

    it('returns 422 when name exceeds 100 characters', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, name: 'A'.repeat(101) }))
      expect(res.status).toBe(422)
    })

    it('returns 422 when name is not a string', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, name: 42 }))
      expect(res.status).toBe(422)
    })
  })

  describe('email validation', () => {
    it('returns 422 when email is missing', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, email: '' }))
      expect(res.status).toBe(422)
      const body = await res.json() as { error: string }
      expect(body.error).toMatch(/email/i)
    })

    it('returns 422 when email has no @', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, email: 'notanemail' }))
      expect(res.status).toBe(422)
    })

    it('returns 422 when email is malformed', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, email: 'user@' }))
      expect(res.status).toBe(422)
    })

    it('returns 422 when email is not a string', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, email: null }))
      expect(res.status).toBe(422)
    })
  })

  describe('category validation', () => {
    it('returns 422 when category is missing', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: '' }))
      expect(res.status).toBe(422)
      const body = await res.json() as { error: string }
      expect(body.error).toMatch(/category/i)
    })

    it('returns 422 when category is not a valid option', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: 'Hacking' }))
      expect(res.status).toBe(422)
    })

    it('accepts all valid categories', async () => {
      const validCategories = [
        'General question', 'Feedback', 'Technical issue',
        'Privacy / data request', 'Subscription', 'Press or partnership', 'Other',
      ]
      for (const category of validCategories) {
        // "Other" has no sub-options; "Subscription" requires one — use appropriate subOption
        const subOption = category === 'Subscription' ? 'Refund request'
          : category === 'General question' ? 'How Soul Space works'
          : category === 'Technical issue' ? "Can't sign in"
          : category === 'Privacy / data request' ? 'Download my data'
          : category === 'Press or partnership' ? 'Media inquiry'
          : category === 'Feedback' ? 'Session experience'
          : ''
        const res = await POST(makeReq({ ...VALID_BASE, category, subOption }))
        expect(res.status).toBe(200)
      }
    })
  })

  describe('subOption validation', () => {
    it('returns 422 for Subscription category without subOption', async () => {
      const res = await POST(makeReq({ ...VALID_WITH_SUB, subOption: '' }))
      expect(res.status).toBe(422)
      const body = await res.json() as { error: string }
      expect(body.error).toMatch(/sub/i)
    })

    it('returns 422 for Subscription category with invalid subOption', async () => {
      const res = await POST(makeReq({ ...VALID_WITH_SUB, subOption: 'make me admin' }))
      expect(res.status).toBe(422)
    })

    it('accepts valid Subscription subOptions', async () => {
      const validSubs = ['Refund request', 'Upgrade plan', 'Downgrade plan', 'Cancellation help', 'Billing issue', 'Other subscription question']
      for (const subOption of validSubs) {
        const res = await POST(makeReq({ ...VALID_WITH_SUB, subOption }))
        expect(res.status).toBe(200)
      }
    })

    it('accepts General question with valid subOption', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: 'General question', subOption: 'How Soul Space works' }))
      expect(res.status).toBe(200)
    })

    it('accepts Technical issue subOptions', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: 'Technical issue', subOption: "Can't sign in" }))
      expect(res.status).toBe(200)
    })

    it('accepts Privacy / data request subOptions', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: 'Privacy / data request', subOption: 'Download my data' }))
      expect(res.status).toBe(200)
    })

    it('does not require subOption for "Other" category', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: 'Other', subOption: '' }))
      expect(res.status).toBe(200)
    })
  })

  describe('message validation', () => {
    it('returns 422 when message is too short (< 10 chars)', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, message: 'short' }))
      expect(res.status).toBe(422)
      const body = await res.json() as { error: string }
      expect(body.error).toMatch(/message/i)
    })

    it('returns 422 when message is empty', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, message: '' }))
      expect(res.status).toBe(422)
    })

    it('returns 422 when message exceeds 4000 characters', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, message: 'A'.repeat(4001) }))
      expect(res.status).toBe(422)
    })

    it('accepts a message of exactly 10 characters', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, message: 'A'.repeat(10) }))
      expect(res.status).toBe(200)
    })

    it('accepts a message of exactly 4000 characters', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, message: 'A'.repeat(4000) }))
      expect(res.status).toBe(200)
    })

    it('accepts message that is only whitespace-padded around valid content', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, message: '  enough content here  ' }))
      expect(res.status).toBe(200)
    })
  })

  describe('request body handling', () => {
    it('returns 400 when body is not valid JSON', async () => {
      const res = await POST(new NextRequest('http://localhost/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json {{{',
      }))
      expect(res.status).toBe(400)
    })
  })

  describe('successful submission', () => {
    const { sendEmail } = jest.requireMock('@/lib/email') as { sendEmail: jest.Mock }

    beforeEach(() => { sendEmail.mockClear() })

    it('returns 200 with ok:true for valid Feedback submission', async () => {
      const res = await POST(makeReq({ ...VALID_BASE, category: 'Feedback', subOption: 'Feature request' }))
      expect(res.status).toBe(200)
      const body = await res.json() as { ok: boolean }
      expect(body.ok).toBe(true)
    })

    it('sends two emails: notification + acknowledgement', async () => {
      await POST(makeReq({ ...VALID_WITH_SUB }))
      expect(sendEmail).toHaveBeenCalledTimes(2)
    })

    it('returns 200 with ok:true for valid Subscription submission', async () => {
      const res = await POST(makeReq({ ...VALID_WITH_SUB }))
      expect(res.status).toBe(200)
      const body = await res.json() as { ok: boolean }
      expect(body.ok).toBe(true)
    })

    it('trims whitespace from name and email before sending', async () => {
      const { contactNotificationEmail } = jest.requireMock('@/lib/email') as {
        contactNotificationEmail: jest.Mock
      }
      contactNotificationEmail.mockClear()
      await POST(makeReq({ ...VALID_BASE, name: '  Ada  ', email: '  ADA@EXAMPLE.COM  ', category: 'Feedback', subOption: 'General feedback' }))
      expect(contactNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ada', email: 'ada@example.com' })
      )
    })
  })
})
