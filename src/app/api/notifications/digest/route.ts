import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, welcomeEmail, reEngagementEmail, adminDailyDigestEmail, checkInDigestEmail, activationNudgeEmail, firstSessionFollowUpEmail } from '@/lib/email'
import { decrypt } from '@/lib/encryption'

// ── Re-engagement digest + admin daily digest + welcome backfill ───────────────
//
// Called by a scheduled job (cron) or manually via POST.
// Protected by CRON_SECRET header (same pattern as other scheduled tasks).
//
// Modes (query param ?mode=):
//   user_digest      — send re-engagement emails to users inactive 7–30 days
//   admin_digest     — send admin daily digest to ADMIN_EMAIL
//   welcome_backfill — send welcome email to users who never received one
//   memory_checkin   — send gentle check-in emails to opted-in users (off by default)
//   lifecycle        — once-ever nudges: activation (signed up, never started a
//                      session) and first-session follow-up (3–4 days after a
//                      user's first completed session, if they haven't returned)
//   all              — all of the above (default)

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
              // Small delay between sends to stay within Brevo rate limits
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

  // ── Lifecycle nudges — each sent AT MOST ONCE per user, ever ──────────────
  // Two moments, mirroring the on-site journey:
  //   A. Activation — registered 2–21 days ago, zero sessions, never nudged.
  //      (The 21-day upper bound avoids cold-emailing long-dormant accounts.)
  //   B. First-session follow-up — exactly one session, it produced a Mirror
  //      (season_assigned), it finished 3–7 days ago, and they haven't been
  //      back. Skipped entirely if that session was safety-flagged (same
  //      crisis gate as memory check-ins).
  // Both are stamped (activation_nudge_sent_at / first_followup_sent_at) so a
  // user can never receive either twice — deliberately NOT a recurring drip.
  if (mode === 'lifecycle' || mode === 'all') {
    try {
      const now = new Date()
      const cutoff2d  = new Date(now.getTime() -  2 * 24 * 60 * 60 * 1000).toISOString()
      const cutoff21d = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString()
      const cutoff3d  = new Date(now.getTime() -  3 * 24 * 60 * 60 * 1000).toISOString()
      const cutoff7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

      // Shared: one pass over all sessions → per-user session list (oldest first)
      const { data: allSessions } = await db
        .from('sessions')
        .select('id, user_id, created_at, completed_at, season_assigned, safety_flagged')
        .order('created_at', { ascending: true })

      const sessionsByUser: Record<string, NonNullable<typeof allSessions>> = {}
      for (const s of allSessions ?? []) {
        if (!s.user_id) continue
        ;(sessionsByUser[s.user_id] ??= []).push(s)
      }

      // ── A. Activation nudge ─────────────────────────────────────────────
      const activation = { sent: 0, failed: 0, eligible: 0 }
      {
        const { data: candidates } = await db
          .from('users')
          .select('id, email, first_name')
          .is('activation_nudge_sent_at', null)
          .lt('created_at', cutoff2d)
          .gte('created_at', cutoff21d)
          .not('email', 'is', null)
          .limit(50)

        const eligible = (candidates ?? []).filter(u => !(sessionsByUser[u.id]?.length))
        activation.eligible = eligible.length

        for (const u of eligible) {
          if (!u.email) continue
          try {
            const template = activationNudgeEmail(u.first_name)
            await sendEmail({ to: u.email, ...template })
            await db.from('users').update({ activation_nudge_sent_at: now.toISOString() }).eq('id', u.id)
            activation.sent++
            await new Promise(r => setTimeout(r, 200))
          } catch {
            activation.failed++
          }
        }
      }

      // ── B. First-session follow-up ──────────────────────────────────────
      const followUp = { sent: 0, failed: 0, eligible: 0, skippedCrisisGate: 0 }
      {
        // Users with exactly one session, Mirror rendered, finished 3–7 days ago
        const candidateIds: string[] = []
        const crisisFlagged: string[] = []
        for (const [uid, list] of Object.entries(sessionsByUser)) {
          if (list.length !== 1) continue
          const s = list[0]
          if (!s.season_assigned) continue
          const doneAt = s.completed_at ?? s.created_at
          if (!(doneAt < cutoff3d && doneAt >= cutoff7d)) continue
          if (s.safety_flagged) { crisisFlagged.push(uid); continue }
          candidateIds.push(uid)
        }
        followUp.skippedCrisisGate = crisisFlagged.length

        if (candidateIds.length > 0) {
          const { data: userData } = await db
            .from('users')
            .select('id, email, first_name')
            .in('id', candidateIds.slice(0, 50))
            .is('first_followup_sent_at', null)
            .not('email', 'is', null)

          followUp.eligible = (userData ?? []).length

          for (const u of userData ?? []) {
            if (!u.email) continue

            // Memory note (optional) — same decrypt-or-fall-back pattern as
            // memory_checkin; a missing note just means the generic variant.
            let memoryNote: string | null = null
            try {
              const sessionId = sessionsByUser[u.id][0].id
              const { data: content } = await db
                .from('session_content')
                .select('encrypted_memory_note')
                .eq('session_id', sessionId)
                .maybeSingle()
              if (content?.encrypted_memory_note) memoryNote = decrypt(content.encrypted_memory_note)
            } catch { memoryNote = null }

            try {
              const template = firstSessionFollowUpEmail(u.first_name, memoryNote)
              await sendEmail({ to: u.email, ...template })
              await db.from('users').update({ first_followup_sent_at: now.toISOString() }).eq('id', u.id)
              followUp.sent++
              await new Promise(r => setTimeout(r, 200))
            } catch {
              followUp.failed++
            }
          }
        }
      }

      results.lifecycle = { activation, followUp }
    } catch (err) {
      results.lifecycle = { error: String(err) }
    }
  }

  // ── Memory check-in emails ─────────────────────────────────────────────────
  // Opt-in only (check_in_frequency != 'off' — off by default, see
  // src/lib/copy/memory.ts CHECK_IN_CONSENT). Mirrors the user_digest
  // cooldown-stamping pattern via last_check_in_sent_at, but the cooldown
  // window depends on the user's chosen cadence:
  //   biweekly → don't resend within 13 days   ("about once every couple of weeks, at most")
  //   monthly  → don't resend within 27 days   ("about monthly")
  //
  // Crisis gate: if the user's most recent session was safety-flagged, skip
  // them entirely this run — Season is suppressed for these, and so is memory
  // and any memory-adjacent outreach. This is the same gate that prevents
  // encrypted_memory_note from ever being written for a flagged session.
  if (mode === 'memory_checkin' || mode === 'all') {
    try {
      const now = new Date()
      const cutoffBiweekly = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString()
      const cutoffMonthly  = new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString()

      const { data: optedInUsers } = await db
        .from('users')
        .select('id, email, first_name, check_in_frequency, last_check_in_sent_at')
        .in('check_in_frequency', ['biweekly', 'monthly'])
        .not('email', 'is', null)
        .limit(50) // cap per run, mirrors user_digest

      if (!optedInUsers || optedInUsers.length === 0) {
        results.memoryCheckin = { sent: 0, reason: 'no opted-in users' }
      } else {
        let sent = 0
        let failed = 0
        let skippedCooldown = 0
        let skippedCrisisGate = 0
        let skippedNoSession = 0

        for (const u of optedInUsers) {
          if (!u.email) continue

          const cutoff = u.check_in_frequency === 'monthly' ? cutoffMonthly : cutoffBiweekly
          if (u.last_check_in_sent_at && u.last_check_in_sent_at > cutoff) {
            skippedCooldown++
            continue
          }

          // Most recent session that produced a mirror — needed both for the
          // crisis gate and (when eligible) the memory note to personalize with.
          const { data: lastSession } = await db
            .from('sessions')
            .select('id, safety_flagged')
            .eq('user_id', u.id)
            .not('season_assigned', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!lastSession) {
            skippedNoSession++
            continue
          }
          if (lastSession.safety_flagged) {
            skippedCrisisGate++
            continue
          }

          let memoryNote: string | null = null
          try {
            const { data: content } = await db
              .from('session_content')
              .select('encrypted_memory_note')
              .eq('session_id', lastSession.id)
              .maybeSingle()
            if (content?.encrypted_memory_note) {
              memoryNote = decrypt(content.encrypted_memory_note)
            }
          } catch {
            memoryNote = null // fall back to the generic variant rather than fail the send
          }

          try {
            const firstName = u.first_name?.trim() || 'there'
            // Rotate subject lines by total sends so the same person doesn't
            // always see the same one — purely cosmetic per checkInEmail's contract.
            const template = checkInDigestEmail(firstName, memoryNote, sent)
            await sendEmail({ to: u.email, ...template })

            await db
              .from('users')
              .update({ last_check_in_sent_at: now.toISOString() })
              .eq('id', u.id)

            sent++
            await new Promise(r => setTimeout(r, 200))
          } catch {
            failed++
          }
        }

        results.memoryCheckin = {
          sent, failed, skippedCooldown, skippedCrisisGate, skippedNoSession,
          eligible: optedInUsers.length,
        }
      }
    } catch (err) {
      results.memoryCheckin = { sent: 0, error: String(err) }
    }
  }

  // ── Welcome email backfill ────────────────────────────────────────────────
  // Catches users whose welcome email was never delivered — e.g. registered
  // before Brevo was configured, or whose auth/callback failed silently.
  // Criteria:
  //   - welcome_email_sent_at IS NULL  (never received the email)
  //   - created_at < 1 hour ago        (skip users currently in sign-in flow)
  // Stamps welcome_email_sent_at after each send to ensure idempotency.
  if (mode === 'welcome_backfill' || mode === 'all') {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      const { data: pendingUsers } = await db
        .from('users')
        .select('id, email')
        .is('welcome_email_sent_at', null)
        .lt('created_at', oneHourAgo)
        .not('email', 'is', null)
        .limit(50)                         // cap per run — cron runs daily

      if (!pendingUsers || pendingUsers.length === 0) {
        results.welcomeBackfill = { sent: 0, reason: 'all users already welcomed' }
      } else {
        let sent = 0
        let failed = 0
        for (const u of pendingUsers) {
          if (!u.email) continue
          try {
            const template = welcomeEmail()
            await sendEmail({ to: u.email, ...template })

            // Stamp so we never send twice
            await db
              .from('users')
              .update({ welcome_email_sent_at: new Date().toISOString() })
              .eq('id', u.id)

            sent++
            // Rate-limit: small delay between sends
            await new Promise(r => setTimeout(r, 200))
          } catch {
            failed++
          }
        }
        results.welcomeBackfill = { sent, failed, found: pendingUsers.length }
      }
    } catch (err) {
      results.welcomeBackfill = { sent: 0, error: String(err) }
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
    modes: ['user_digest', 'admin_digest', 'welcome_backfill', 'memory_checkin', 'lifecycle', 'all'],
  })
}
