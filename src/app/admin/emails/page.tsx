'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { BrevoEmail, BrevoEvent } from '@/app/api/admin/emails/route'

interface Quota {
  daily:     number
  usedToday: number
  remaining: number
  pct:       number
}

interface Stats {
  sent:         number
  delivered:    number
  opens:        number
  bounces:      number
  spam:         number
  blocked:      number
  openRate:     number | null
  deliveryRate: number | null
  window:       string
  startDate:    string
  endDate:      string
}

interface EmailsResponse {
  quota:  Quota
  stats:  Stats
  emails: BrevoEmail[]
  total:  number
  limit:  number
  offset: number
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const EVENT_PRIORITY: Record<string, number> = {
  clicked:      7,
  opened:       6,
  delivered:    5,
  deferred:     4,
  softBounces:  3,
  hardBounces:  2,
  spam:         2,
  blocked:      1,
  invalid:      1,
  unsubscribed: 1,
  requests:     0,
}

const EVENT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  clicked:     { label: 'Clicked',    color: '#3DAF96', bg: 'rgba(42,140,122,.14)',  border: 'rgba(42,140,122,.3)'  },
  opened:      { label: 'Opened',     color: '#3DAF96', bg: 'rgba(42,140,122,.10)',  border: 'rgba(42,140,122,.22)' },
  delivered:   { label: 'Delivered',  color: '#6B8CAE', bg: 'rgba(107,140,174,.12)', border: 'rgba(107,140,174,.25)'},
  deferred:    { label: 'Deferred',   color: '#C9A84C', bg: 'rgba(201,168,76,.12)',  border: 'rgba(201,168,76,.25)' },
  softBounces: { label: 'Soft bounce',color: '#C9A84C', bg: 'rgba(201,168,76,.10)',  border: 'rgba(201,168,76,.22)' },
  hardBounces: { label: 'Bounced',    color: '#D44040', bg: 'rgba(212,64,64,.10)',   border: 'rgba(212,64,64,.22)'  },
  spam:        { label: 'Spam',       color: '#D44040', bg: 'rgba(212,64,64,.10)',   border: 'rgba(212,64,64,.22)'  },
  blocked:     { label: 'Blocked',    color: '#D44040', bg: 'rgba(212,64,64,.08)',   border: 'rgba(212,64,64,.18)'  },
  invalid:     { label: 'Invalid',    color: '#D44040', bg: 'rgba(212,64,64,.08)',   border: 'rgba(212,64,64,.18)'  },
  unsubscribed:{ label: 'Unsub',      color: '#8BA7B8', bg: 'rgba(139,167,184,.10)', border: 'rgba(139,167,184,.2)' },
  requests:    { label: 'Sent',       color: '#8BA7B8', bg: 'rgba(139,167,184,.08)', border: 'rgba(139,167,184,.18)'},
}

function topEvent(events: BrevoEvent[]): string {
  if (!events?.length) return 'requests'
  return events.reduce((best, e) => {
    const p = EVENT_PRIORITY[e.name] ?? -1
    return p > (EVENT_PRIORITY[best] ?? -1) ? e.name : best
  }, 'requests')
}

function StatusBadge({ events }: { events: BrevoEvent[] }) {
  const key  = topEvent(events)
  const meta = EVENT_META[key] ?? EVENT_META.requests
  return (
    <span style={{
      fontSize: '16px', padding: '2px 7px', borderRadius: '4px', fontWeight: 500,
      color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// ── Quota bar ──────────────────────────────────────────────────────────────────
function QuotaBar({ quota }: { quota: Quota }) {
  const warn  = quota.pct >= 80
  const crit  = quota.pct >= 95
  const color = crit ? '#D44040' : warn ? '#C9A84C' : '#3DAF96'

  return (
    <div style={{
      background: 'var(--ink2)', border: `1px solid ${color}28`,
      borderRadius: 'var(--r-lg)', padding: '16px 20px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
          Daily Sending Quota — Free Plan
        </div>
        <div style={{ fontSize: '17px', color: crit ? '#D44040' : warn ? '#C9A84C' : 'var(--mist)' }}>
          {quota.usedToday} / {quota.daily} sent today · {quota.remaining} remaining
        </div>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(245,237,216,.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.min(quota.pct, 100)}%`,
          background: color,
          transition: 'width .5s ease',
        }} />
      </div>
      {crit && (
        <div style={{ marginTop: '8px', fontSize: '16px', color: '#D44040' }}>
          ⚠ Near daily limit — emails may be blocked until midnight UTC
        </div>
      )}
      {warn && !crit && (
        <div style={{ marginTop: '8px', fontSize: '16px', color: '#C9A84C' }}>
          Approaching daily limit. Resets at midnight UTC.
        </div>
      )}
      <div style={{ marginTop: '8px', fontSize: '16px', color: 'rgba(213,226,235,.40)' }}>
        Free plan: 300 emails/day · 30-day log retention · Shared across all environments
      </div>
    </div>
  )
}

// ── Stat cards ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: 'var(--ink2)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--r-lg)', padding: '16px 18px',
    }}>
      <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: accent ?? 'var(--sand2)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function fmtDateShort(iso: string) {
  return iso.slice(0, 10)
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// ── Filter bar ────────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'opened',   label: 'Opened' },
  { value: 'delivered',label: 'Delivered' },
  { value: 'bounced',  label: 'Bounced' },
  { value: 'spam',     label: 'Spam' },
]

// ── Main inner component ──────────────────────────────────────────────────────
function EmailsInner() {
  const searchParams = useSearchParams()

  const [data, setData]           = useState<EmailsResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [notConfigured, setNot]   = useState(false)

  // Filter state
  const [emailFilter, setEmailFilter]     = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')
  const [offset, setOffset]               = useState(0)
  const LIMIT = 50

  const load = useCallback((off = 0) => {
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
    if (emailFilter.trim()) qs.set('email', emailFilter.trim())
    if (startDate) qs.set('startDate', startDate)
    if (endDate)   qs.set('endDate', endDate)

    fetch(`/api/admin/emails?${qs}`)
      .then(r => r.json())
      .then((d: EmailsResponse & { error?: string; not_configured?: boolean }) => {
        if (d.not_configured) { setNot(true); return }
        if (d.error) throw new Error(d.error)
        setNot(false)
        setData(d)
        setOffset(off)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [emailFilter, startDate, endDate])

  useEffect(() => { load(0) }, [load])

  // Client-side status filter
  const visibleEmails = data?.emails.filter(e => {
    if (statusFilter === 'all') return true
    const top = topEvent(e.events)
    if (statusFilter === 'bounced') return top === 'hardBounces' || top === 'softBounces'
    return top === statusFilter
  }) ?? []

  if (notConfigured) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Emails
        </div>
        <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)' }}>
          BREVO_API_KEY is not configured on this server. Add it to .env.local or Vercel environment variables.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Emails · Brevo
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          Email Tracker
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.3)', borderRadius: 'var(--r-lg)', color: '#D44040', fontSize: 'var(--fs-sm)' }}>
          {error}
        </div>
      )}

      {/* Quota bar */}
      {data && <QuotaBar quota={data.quota} />}
      {loading && !data && (
        <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '16px 20px', marginBottom: '20px', height: '90px' }} />
      )}

      {/* Stats grid */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <StatCard
            label="Sent (7d)"
            value={data.stats.sent.toLocaleString()}
            sub={`${fmtDateShort(data.stats.startDate)} → ${fmtDateShort(data.stats.endDate)}`}
          />
          <StatCard
            label="Delivered"
            value={data.stats.deliveryRate !== null ? `${data.stats.deliveryRate}%` : '—'}
            sub={`${data.stats.delivered} emails`}
            accent={data.stats.deliveryRate !== null && data.stats.deliveryRate >= 95 ? '#3DAF96' : undefined}
          />
          <StatCard
            label="Open Rate"
            value={data.stats.openRate !== null ? `${data.stats.openRate}%` : '—'}
            sub={`${data.stats.opens} opens`}
            accent={data.stats.openRate !== null && data.stats.openRate >= 20 ? '#3DAF96' : undefined}
          />
          <StatCard
            label="Bounced"
            value={data.stats.bounces.toLocaleString()}
            sub={`${data.stats.spam} spam · ${data.stats.blocked} blocked`}
            accent={data.stats.bounces > 0 ? '#C9A84C' : undefined}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
        marginBottom: '16px', padding: '14px 16px',
        background: 'var(--ink2)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-lg)',
      }}>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              style={{
                padding: '4px 10px', borderRadius: '4px', fontSize: '16px', fontWeight: 500,
                border: statusFilter === f.value ? '1px solid rgba(201,168,76,.5)' : '1px solid var(--hairline)',
                background: statusFilter === f.value ? 'rgba(201,168,76,.12)' : 'transparent',
                color: statusFilter === f.value ? 'var(--gold)' : 'var(--mist)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--hairline)' }} />

        {/* Recipient search */}
        <input
          type="text"
          value={emailFilter}
          onChange={e => setEmailFilter(e.target.value)}
          placeholder="Filter by recipient email…"
          style={{
            background: 'rgba(245,237,216,.04)', border: '1px solid var(--hairline)',
            borderRadius: '6px', padding: '5px 10px', fontSize: '17px',
            color: 'var(--sand)', fontFamily: 'var(--font-sans)', minWidth: '220px',
          }}
        />

        {/* Date range */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{
              background: 'rgba(245,237,216,.04)', border: '1px solid var(--hairline)',
              borderRadius: '6px', padding: '4px 8px', fontSize: '16px',
              color: 'var(--sand)', fontFamily: 'var(--font-sans)',
            }}
          />
          <span style={{ fontSize: '16px', color: 'var(--mist)' }}>→</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{
              background: 'rgba(245,237,216,.04)', border: '1px solid var(--hairline)',
              borderRadius: '6px', padding: '4px 8px', fontSize: '16px',
              color: 'var(--sand)', fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <button
          onClick={() => load(0)}
          style={{
            padding: '5px 14px', borderRadius: '6px', fontSize: '16px', fontWeight: 500,
            border: '1px solid rgba(201,168,76,.35)', background: 'rgba(201,168,76,.08)',
            color: 'var(--gold)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          Apply
        </button>

        {(emailFilter || startDate || endDate || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setEmailFilter('')
              setStartDate('')
              setEndDate('')
              setStatusFilter('all')
            }}
            style={{
              padding: '5px 10px', borderRadius: '6px', fontSize: '16px',
              border: '1px solid var(--hairline)', background: 'transparent',
              color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Email table */}
      <div style={{
        background: 'var(--ink2)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 1fr 90px',
          padding: '10px 16px',
          borderBottom: '1px solid var(--hairline)',
          fontSize: '16px', letterSpacing: '0.10em', textTransform: 'uppercase',
          color: 'var(--mist)',
        }}>
          <div>Date / Time</div>
          <div>Recipient</div>
          <div>Subject</div>
          <div>Status</div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 1fr 90px',
              padding: '12px 16px', borderBottom: '1px solid rgba(245,237,216,.03)',
              gap: '12px',
            }}>
              {[80, 160, 200, 60].map((w, j) => (
                <div key={j} style={{
                  height: '12px', borderRadius: '4px',
                  width: `${w}px`, background: 'rgba(245,237,216,.04)',
                }} />
              ))}
            </div>
          ))
        )}

        {/* Rows */}
        {!loading && visibleEmails.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--mist)' }}>
            {statusFilter !== 'all' || emailFilter || startDate || endDate
              ? 'No emails match the current filters.'
              : 'No emails found in Brevo log. Free plan retains 30 days of history.'}
          </div>
        )}

        {!loading && visibleEmails.map((email, i) => (
          <div
            key={email.messageId ?? i}
            style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 1fr 90px',
              padding: '11px 16px', borderBottom: '1px solid rgba(245,237,216,.03)',
              alignItems: 'center', gap: '12px',
              transition: 'background .1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,237,216,.025)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <div style={{ fontSize: '16px', color: 'var(--mist)', whiteSpace: 'nowrap' }}>
              {email.date ? fmtDate(email.date) : '—'}
            </div>
            <div style={{ fontSize: '17px', color: 'var(--sand)', overflow: 'hidden' }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email.email}
              </div>
              {email.from && (
                <div style={{ fontSize: '16px', color: 'var(--mist)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  from: {email.from}
                </div>
              )}
            </div>
            <div style={{ fontSize: '17px', color: 'var(--mist)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.subject ? truncate(email.subject, 60) : <span style={{ opacity: 0.4 }}>—</span>}
            </div>
            <div>
              <StatusBadge events={email.events ?? []} />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data && (data.emails.length === LIMIT || offset > 0) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
          <div style={{ fontSize: '16px', color: 'var(--mist)' }}>
            Showing {offset + 1}–{offset + data.emails.length}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => load(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              style={{
                padding: '5px 14px', borderRadius: '6px', fontSize: '16px', fontWeight: 500,
                border: '1px solid var(--hairline)', background: 'transparent',
                color: offset === 0 ? 'rgba(213,226,235,.25)' : 'var(--mist)',
                cursor: offset === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => load(offset + LIMIT)}
              disabled={data.emails.length < LIMIT}
              style={{
                padding: '5px 14px', borderRadius: '6px', fontSize: '16px', fontWeight: 500,
                border: '1px solid var(--hairline)', background: 'transparent',
                color: data.emails.length < LIMIT ? 'rgba(213,226,235,.25)' : 'var(--mist)',
                cursor: data.emails.length < LIMIT ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Brevo retention note */}
      <div style={{ marginTop: '20px', fontSize: '16px', color: 'rgba(213,226,235,.35)', textAlign: 'center' }}>
        Brevo free plan retains transactional email logs for 30 days · API rate limit: 20 req/s ·
        Data refreshes every 60 s
      </div>

    </div>
  )
}

function LoadingShell() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mist)' }}>Loading…</div>
    </div>
  )
}

export default function EmailsPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <EmailsInner />
    </Suspense>
  )
}
