import { NextRequest, NextResponse } from 'next/server'
import {
  sendEmail,
  welcomeEmail,
  subscriptionConfirmationEmail,
  subscriptionCancellationEmail,
  subscriptionExpiredEmail,
  paymentFailedEmail,
  paymentRecoveredEmail,
  accountDeletionEmail,
  reEngagementEmail,
  adminSafetyAlertEmail,
  adminDailyDigestEmail,
} from '@/lib/email'

// ── Auth ───────────────────────────────────────────────────────────────────────
// Uses ADMIN_SECRET passed as x-admin-secret header or ?secret= query param.
// This route is intentionally NOT behind the cookie-based admin session because
// it needs to be callable via curl for testing purposes.
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const header = req.headers.get('x-admin-secret')
  const query  = req.nextUrl.searchParams.get('secret')
  return header === secret || query === secret
}

// ── Sample data used in all templated emails ───────────────────────────────────
const SAMPLE = {
  planName:    'Essentials',
  periodEnd:   new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(), // 31 days from now
  retryDate:   new Date(Date.now() +  3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
  sessionId:   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  flagType:    'crisis_language',
  branch:      'D',
  flagsUnreviewed: 3,
  daysSinceLast:   12,
  stats: {
    newUsers:       5,
    sessions24h:   18,
    safetyFlags24h: 1,
    mrr:            49.95,
    resonanceRate:  67,
  },
}

// ── All email types in send order ──────────────────────────────────────────────
function buildAll(to: string) {
  return [
    { type: 'welcome',                   ...welcomeEmail() },
    { type: 'subscription_confirmation', ...subscriptionConfirmationEmail(SAMPLE.planName) },
    { type: 'subscription_cancellation', ...subscriptionCancellationEmail(SAMPLE.planName, SAMPLE.periodEnd) },
    { type: 'subscription_expired',      ...subscriptionExpiredEmail() },
    { type: 'payment_failed',            ...paymentFailedEmail(SAMPLE.planName, SAMPLE.retryDate) },
    { type: 'payment_recovered',         ...paymentRecoveredEmail(SAMPLE.planName) },
    { type: 'account_deletion',          ...accountDeletionEmail() },
    { type: 're_engagement',             ...reEngagementEmail(SAMPLE.daysSinceLast) },
    { type: 'admin_safety_alert',        ...adminSafetyAlertEmail({
        sessionId:       SAMPLE.sessionId,
        flagType:        SAMPLE.flagType,
        branch:          SAMPLE.branch,
        flagsUnreviewed: SAMPLE.flagsUnreviewed,
      }) },
    { type: 'admin_daily_digest',        ...adminDailyDigestEmail(SAMPLE.stats) },
  ].map(e => ({ ...e, to }))
}

// ── GET /api/admin/test-email ──────────────────────────────────────────────────
// Query params:
//   secret=ADMIN_SECRET   (or x-admin-secret header)
//   to=recipient@email    (required)
//   type=all|<type>       (default: all)
//
// Example:
//   GET /api/admin/test-email?secret=XXX&to=you@email.com&type=all
//   GET /api/admin/test-email?secret=XXX&to=you@email.com&type=welcome
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const to = req.nextUrl.searchParams.get('to')
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Missing or invalid ?to= email address' }, { status: 400 })
  }

  const typeParam = req.nextUrl.searchParams.get('type') ?? 'all'
  const all = buildAll(to)
  const queue = typeParam === 'all'
    ? all
    : all.filter(e => e.type === typeParam)

  if (queue.length === 0) {
    const valid = all.map(e => e.type).join(', ')
    return NextResponse.json({ error: `Unknown type "${typeParam}". Valid: all, ${valid}` }, { status: 400 })
  }

  const results: { type: string; subject: string; ok: boolean; error?: string }[] = []

  for (const email of queue) {
    try {
      await sendEmail({ to: email.to, subject: email.subject, htmlContent: email.htmlContent, textContent: email.textContent })
      results.push({ type: email.type, subject: email.subject, ok: true })
      console.log(`[test-email] ✓ ${email.type} → ${to}`)
      // Small delay so Brevo doesn't rate-limit bursts
      if (queue.length > 1) await new Promise(r => setTimeout(r, 600))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ type: email.type, subject: email.subject, ok: false, error: msg })
      console.error(`[test-email] ✗ ${email.type}: ${msg}`)
    }
  }

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({
    sent:   results.filter(r =>  r.ok).length,
    failed: failed.length,
    to,
    results,
  }, { status: failed.length > 0 ? 207 : 200 })
}
