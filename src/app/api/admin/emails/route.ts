import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'

// Brevo free plan: 300 emails/day, 30-day log retention.
// /smtp/emails requires email|messageId|templateId filter on free plan.
// /smtp/statistics/events works with date range alone — used for the email log.
const BREVO_BASE       = 'https://api.brevo.com/v3'
const FREE_DAILY_LIMIT = 300

export interface BrevoEvent { name: string; time: string }
export interface BrevoEmail {
  email:      string
  date:       string
  messageId:  string
  subject:    string
  tag:        string | null
  from:       string
  templateId: number | null
  events:     BrevoEvent[]
}

interface BrevoReport {
  date:          string
  requests:      number
  delivered:     number
  hardBounces:   number
  softBounces:   number
  opens:         number
  uniqueOpens:   number
  clicks:        number
  uniqueClicks:  number
  spamReports:   number
  blocked:       number
  invalid:       number
  unsubscribed:  number
}

interface BrevoStatEvent {
  email:      string
  date:       string
  subject:    string
  messageId:  string
  event:      string
  reason:     string
  tag:        string
  from:       string
  templateId: number | null
}

interface BrevoAccountPlan {
  type:        string
  creditsType: string
  credits:     number
}

function brevoFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${BREVO_BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), {
    headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY ?? '' },
    next: { revalidate: 60 },
  })
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.BREVO_API_KEY) {
    return NextResponse.json(
      { error: 'BREVO_API_KEY is not configured', not_configured: true },
      { status: 503 }
    )
  }

  const sp        = req.nextUrl.searchParams
  const limit     = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)))
  const offset    = Math.max(0, parseInt(sp.get('offset') ?? '0', 10))
  const startDate = sp.get('startDate') ?? undefined
  const endDate   = sp.get('endDate') ?? undefined
  const toEmail   = sp.get('email') ?? undefined

  const today         = isoDate(new Date())
  const sevenDaysAgo  = isoDate(new Date(Date.now() - 6  * 24 * 60 * 60 * 1000))
  const thirtyDaysAgo = isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))

  const eventsParams: Record<string, string> = {
    limit:     '500',
    startDate: startDate ?? thirtyDaysAgo,
    endDate:   endDate   ?? today,
  }
  if (toEmail) eventsParams.email = toEmail

  try {
    const [accountRes, todayRes, weekRes, eventsRes] = await Promise.all([
      brevoFetch('/account'),
      brevoFetch('/smtp/statistics/reports', { startDate: today,       endDate: today }),
      brevoFetch('/smtp/statistics/reports', { startDate: sevenDaysAgo, endDate: today }),
      brevoFetch('/smtp/statistics/events',  eventsParams),
    ])

    if (!eventsRes.ok) {
      const body = await eventsRes.text()
      return NextResponse.json(
        { error: `Brevo events error: ${eventsRes.status} — ${body}` },
        { status: 502 }
      )
    }

    const accountData = accountRes.ok
      ? await accountRes.json() as { plan?: BrevoAccountPlan[] }
      : null
    const todayData   = todayRes.ok
      ? (await todayRes.json() as { reports: BrevoReport[] }).reports?.[0]
      : null
    const weekReports = weekRes.ok
      ? (await weekRes.json() as { reports: BrevoReport[] }).reports ?? []
      : []
    const eventsData  = await eventsRes.json() as { events?: BrevoStatEvent[] }

    // Group events by messageId → reconstruct per-email rows sorted by send time desc
    const grouped = new Map<string, BrevoEmail>()
    for (const ev of eventsData.events ?? []) {
      const key = ev.messageId || `${ev.email}::${ev.subject}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          email:      ev.email,
          date:       ev.date,
          messageId:  ev.messageId ?? '',
          subject:    ev.subject   ?? '',
          tag:        ev.tag       ?? null,
          from:       ev.from      ?? '',
          templateId: ev.templateId ?? null,
          events:     [],
        })
      }
      const entry = grouped.get(key)!
      entry.events.push({ name: ev.event, time: ev.date })
      // Earliest event date = send date
      if (new Date(ev.date) < new Date(entry.date)) entry.date = ev.date
    }

    const allEmails = Array.from(grouped.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const emails = allEmails.slice(offset, offset + limit)

    // Quota
    const plans      = accountData?.plan ?? []
    const dailyLimit = plans.find(p => p.creditsType === 'sendingLimit')?.credits ?? FREE_DAILY_LIMIT
    const sentToday  = todayData?.requests ?? 0

    // 7-day aggregate stats
    const agg = weekReports.reduce(
      (acc, r: BrevoReport) => ({
        sent:      acc.sent      + r.requests,
        delivered: acc.delivered + r.delivered,
        opens:     acc.opens     + r.opens,
        bounces:   acc.bounces   + r.hardBounces + r.softBounces,
        spam:      acc.spam      + r.spamReports,
        blocked:   acc.blocked   + r.blocked,
      }),
      { sent: 0, delivered: 0, opens: 0, bounces: 0, spam: 0, blocked: 0 }
    )

    const openRate     = agg.sent > 0 ? Math.round((agg.opens     / agg.sent) * 1000) / 10 : null
    const deliveryRate = agg.sent > 0 ? Math.round((agg.delivered / agg.sent) * 1000) / 10 : null

    return NextResponse.json({
      quota: {
        daily:     dailyLimit,
        usedToday: sentToday,
        remaining: Math.max(0, dailyLimit - sentToday),
        pct:       dailyLimit > 0 ? Math.round((sentToday / dailyLimit) * 100) : 0,
      },
      stats: {
        ...agg,
        openRate,
        deliveryRate,
        window:    '7d',
        startDate: sevenDaysAgo,
        endDate:   today,
      },
      emails,
      total:  allEmails.length,
      limit,
      offset,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[admin/emails]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
