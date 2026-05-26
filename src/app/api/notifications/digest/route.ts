import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, reEngagementEmail, adminDailyDigestEmail } from '@/lib/email'

// ── Re-engagement digest + admin daily digest ──────────────────────────────────
//
// Called by a scheduled job (cron) or manually via POST.
// Protected by CRON_SECRET header (same pattern as other scheduled tasks).
//
// Modes (query param ?mode=):
//   user_digest  — send re-engagement emails to users inactive 7–30 days
//   admin_digest — send admin daily digest to ADMIN_EMAIL
//   all          — both (default)

export async function POST(req: NextRequest) {
  // Simple shared-secret auth so only the cron can call this
  const secret = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? 'all'
  const db = createServiceClient()
  const results: Record<string, unknown> = {}

  // ── Admin daily digest ─────────────────────────────────────────────────────
  if (mode === 'admin_digest' || mode === 'all') {
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      try {
        const now = new Date()
        const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

        const [
          { count: newUsers },
          { count: sessions24h },
          { count: safetyFlags24h },
          { data: resonanceRows },
          { data: activeSubs },
        ] = await Promise.all([
          db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
          db.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
          db.from('safety_events').select('*', { count: 'exact', head: true }).gte('timestamp', since24h),
          db.from('sessions').select('resonance_tap').not('resonance_tap', 'is', null).gte('created_at', since24h),
          db.from('subscriptions').select('plan_tier').eq('status', 'active'),
        ])

        const accurate = (resonanceRows ?? []).filter(r => r.resonance_tap === 'accurate').length
        const totalTapped = (resonanceRows ?? []).length
        const resonanceRate = totalTapped > 0 ? Math.round((accurate / totalTapped) * 100) : null

        const essentials = (activeSubs ?? []).filter(s => s.plan_tier === 'essentials').length
        const insights   = (activeSubs ?? []).filter(s => s.plan_tier === 'insights').length
        const mrr = essentials * 9.99 + insights * 19.99

        const template = adminDailyDigestEmail({
          newUsers: newUsers ?? 0,
          sessions24h: sessions24h ?? 0,
          safetyFlags24h: safetyFlags24h ?? 0,
          mrr: Math.round(mrr * 100) / 100,
          resonanceRate,
        })
        await sendEmail({ to: adminEmail, ...template })
        results.adminDigest = { sent: true, to: adminEmail }
      } catch (err) {
        results.adminDigest = { sent: false, error: String(err) }
      }
    } else {
      results.adminDigest = { skipped: true, reason: 'ADMIN_EMAIL not set' }
    }
  }

  // ── User re-engagement emails ──────────────────────────────────────────────
  if (mode === 'user_digest' || mode === 'all') {
    try {
      const now = new Date()
      const cutoff7d    = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
      const cutoff30d   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      // Don't re-send to anyone who received a re-engagement email in the last 14 days
      const cutoff14d   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

      // Find users whose last session was 7–30 days ago
      // Strategy: get users with at least 1 session, join with latest session date
      const { data: usersWithSessions } = await db
        .from('sessions')
        .select('user_id, created_at')
        .order('created_at', { ascending: false })

      if (!usersWithSessions) {
        results.userDigest = { skipped: true, reason: 'no session data' }
      } else {
        // Build map: user_id → most recent session date
        const latestSession: Record<string, string> = {}
        for (const s of usersWithSessions) {
          if (!latestSession[s.user_id]) latestSession[s.user_id] = s.created_at
        }

        // Filter: last session between 7 and 30 days ago
        const eligibleUserIds = Object.entries(latestSession)
          .filter(([, lastAt]) => lastAt < cutoff7d && lastAt >= cutoff30d)
          .map(([uid]) => uid)

        if (eligibleUserIds.length === 0) {
          results.userDigest = { sent: 0, reason: 'no eligible users' }
        } else {
          // Fetch emails for eligible users (batch, max 50 per run to avoid rate limits)
          // Also fetch last_re_engagement_sent_at to enforce the 14-day cooldown
          const batchIds = eligibleUserIds.slice(0, 50)
          const { data: userData } = await db
            .from('users')
            .select('id, email, last_re_engagement_sent_at')
            .in('id', batchIds)

          let sent = 0
          let failed = 0
          let skippedCooldown = 0
          for (const u of userData ?? []) {
            if (!u.email) continue

            // Skip if re-engagement email sent within the last 14 days
            if (u.last_re_engagement_sent_at && u.last_re_engagement_sent_at > cutoff14d) {
              skippedCooldown++
              continue
            }

            try {
              // Days since last session
              const lastAt = latestSession[u.id]
              const daysSince = Math.round((now.getTime() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24))
              const template = reEngagementEmail(daysSince)
              await sendEmail({ to: u.email, ...template })

              // Stamp the send time so we don't re-send within the cooldown window
              await db
                .from('users')
                .update({ last_re_engagement_sent_at: now.toISOString() })
                .eq('id', u.id)

              sent++
              // Small delay to stay within Brevo rate limits (300 emails/min on free plan)
              await new Promise(r => setTimeout(r, 200))
            } catch {
              failed++
            }
          }
          results.userDigest = { sent, failed, skippedCooldown, eligible: eligibleUserIds.length }
        }
      }
    } catch (err) {
      results.userDigest = { sent: 0, error: String(err) }
    }
  }

  return NextResponse.json({ ok: true, mode, results })
}

// GET version for quick health check / manual trigger from browser
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    info: 'POST to this endpoint with x-cron-secret header to trigger digests.',
    modes: ['user_digest', 'admin_digest', 'all'],
  })
}
