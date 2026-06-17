'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

interface Submission {
  id:         string
  name:       string
  email:      string
  category:   string
  sub_option: string
  message:    string
  replied:    boolean
  reply_body: string | null
  replied_at: string | null
  created_at: string
}

interface ContactResponse {
  submissions: Submission[]
  total:       number
  unreplied:   number
  page:        number
  pages:       number
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Feedback':               { color: '#3DAF96', bg: 'rgba(42,140,122,.12)',  border: 'rgba(42,140,122,.25)'  },
  'General question':       { color: '#6B8CAE', bg: 'rgba(107,140,174,.12)', border: 'rgba(107,140,174,.25)' },
  'Technical issue':        { color: '#C9A84C', bg: 'rgba(201,168,76,.12)',  border: 'rgba(201,168,76,.25)'  },
  'Privacy / data request': { color: '#C4784A', bg: 'rgba(196,120,74,.12)',  border: 'rgba(196,120,74,.25)'  },
  'Subscription':           { color: '#9B8ADE', bg: 'rgba(155,138,222,.12)', border: 'rgba(155,138,222,.25)' },
  'Press or partnership':   { color: '#8BA7B8', bg: 'rgba(139,167,184,.12)', border: 'rgba(139,167,184,.25)' },
  'Other':                  { color: '#8BA7B8', bg: 'rgba(139,167,184,.08)', border: 'rgba(139,167,184,.18)' },
}

function catStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']
}

function CategoryBadge({ cat, sub }: { cat: string; sub?: string }) {
  const s = catStyle(cat)
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      fontWeight: 500, letterSpacing: '0.03em',
    }}>
      {sub ? `${cat} · ${sub}` : cat}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ContactInner() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const pathname      = usePathname()

  const env    = (searchParams.get('env')    ?? getDefaultAdminEnv()) as AdminEnv
  const page   = parseInt(searchParams.get('page')   ?? '1', 10)
  const filter = searchParams.get('filter') ?? 'all'
  const q      = searchParams.get('q') ?? ''

  const [data, setData]               = useState<ContactResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [notConfigured, setNot]       = useState(false)
  const [selected, setSelected]       = useState<Submission | null>(null)
  const [reply, setReply]             = useState('')
  const [sending, setSending]         = useState(false)
  const [sendErr, setSendErr]         = useState('')
  const [sendOk, setSendOk]           = useState(false)
  const [search, setSearch]           = useState(q)
  const searchTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null)

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.set('page', '1')
    router.push(`${pathname}?${p.toString()}`)
  }

  function loadData() {
    setLoading(true)
    setError('')
    setNot(false)
    const params = new URLSearchParams({ env, page: String(page), filter })
    if (q) params.set('q', q)
    fetch(`/api/admin/contact?${params}`)
      .then(r => r.json())
      .then((d: ContactResponse & { error?: string; not_configured?: boolean }) => {
        if (d.not_configured) { setNot(true); return }
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [env, page, filter, q]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectSubmission(sub: Submission) {
    setSelected(sub)
    setReply('')
    setSendErr('')
    setSendOk(false)
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return
    setSending(true)
    setSendErr('')
    setSendOk(false)
    try {
      const res  = await fetch('/api/admin/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: selected.id, reply: reply.trim(), env }),
      })
      const body = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) { setSendErr(body.error ?? 'Failed to send.'); return }
      setSendOk(true)
      setSelected(s => s ? { ...s, replied: true, reply_body: reply.trim(), replied_at: new Date().toISOString() } : s)
      setData(d => d ? {
        ...d,
        unreplied:   Math.max(0, d.unreplied - (selected.replied ? 0 : 1)),
        submissions: d.submissions.map(s => s.id === selected.id ? { ...s, replied: true } : s),
      } : d)
    } catch (e) {
      setSendErr((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Shell><div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div></Shell>
  if (notConfigured) return <Shell><div style={{ padding: '28px 32px' }}><AdminEnvNotConfigured env={env} /></div></Shell>
  if (error) return <Shell><div style={{ padding: '28px 32px', color: '#D44040' }}>Error: {error}</div></Shell>

  const submissions = data?.submissions ?? []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Left panel: list ──────────────────────────────────────────────── */}
      <div style={{
        width: '340px', flexShrink: 0, borderRight: '1px solid var(--hairline)',
        display: 'flex', flexDirection: 'column', height: '100%',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--hairline)', paddingBottom: '16px' }}>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
            Contact · {env.toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
              Inbox
            </h1>
            {(data?.unreplied ?? 0) > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px',
                background: 'rgba(201,168,76,.18)', border: '1px solid rgba(201,168,76,.35)', color: '#C9A84C',
              }}>
                {data!.unreplied} unreplied
              </span>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
            {(['all', 'unreplied'] as const).map(f => (
              <button key={f} onClick={() => setParam('filter', f === 'all' ? '' : f)}
                style={{
                  fontSize: '12px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontWeight: filter === f ? 600 : 400,
                  border: filter === f ? '1px solid rgba(245,237,216,.2)' : '1px solid transparent',
                  background: filter === f ? 'rgba(245,237,216,.06)' : 'transparent',
                  color: filter === f ? 'var(--sand2)' : 'var(--mist)',
                }}
              >
                {f === 'all' ? `All (${data?.total ?? 0})` : `Unreplied (${data?.unreplied ?? 0})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ marginTop: '10px' }}>
            <input
              type="text" placeholder="Search name or email…" value={search}
              onChange={e => {
                setSearch(e.target.value)
                if (searchTimer.current) clearTimeout(searchTimer.current)
                searchTimer.current = setTimeout(() => setParam('q', e.target.value), 400)
              }}
              style={{
                width: '100%', background: 'rgba(245,237,216,.04)', border: '1px solid var(--hairline)',
                borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--sand)',
                fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {submissions.length === 0 ? (
            <div style={{ padding: '28px 20px', color: 'var(--mist)', fontSize: 'var(--fs-sm)', textAlign: 'center' }}>
              No submissions found.
            </div>
          ) : submissions.map(sub => {
            const isSelected = selected?.id === sub.id
            return (
              <button key={sub.id} onClick={() => selectSubmission(sub)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '14px 20px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(245,237,216,.05)' : 'transparent',
                  borderTop: 'none', borderRight: 'none',
                  borderBottom: '1px solid var(--hairline)',
                  borderLeft: isSelected ? '2px solid var(--gold)' : '2px solid transparent',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sand2)' }}>{sub.name}</span>
                  {sub.replied ? (
                    <span style={{ fontSize: '10px', color: '#3DAF96', background: 'rgba(42,140,122,.1)', border: '1px solid rgba(42,140,122,.2)', borderRadius: '4px', padding: '1px 6px' }}>Replied</span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#C9A84C', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: '4px', padding: '1px 6px' }}>Unreplied</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--mist)', marginBottom: '6px' }}>{sub.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <CategoryBadge cat={sub.category} />
                  <span style={{ fontSize: '10px', color: 'rgba(213,226,235,.4)' }}>
                    {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </button>
            )
          })}

          {/* Pagination */}
          {(data?.pages ?? 1) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
              {page > 1 && (
                <button onClick={() => setParam('page', String(page - 1))}
                  style={{ fontSize: '12px', color: 'var(--mist)', background: 'transparent', border: '1px solid var(--hairline)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  ← Prev
                </button>
              )}
              <span style={{ fontSize: '12px', color: 'var(--mist)', alignSelf: 'center' }}>{page} / {data?.pages}</span>
              {page < (data?.pages ?? 1) && (
                <button onClick={() => setParam('page', String(page + 1))}
                  style={{ fontSize: '12px', color: 'var(--mist)', background: 'transparent', border: '1px solid var(--hairline)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: detail + reply ───────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', minWidth: 0 }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', opacity: 0.2, marginBottom: '12px' }}>✉</div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mist)' }}>Select a submission to view details.</p>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '680px' }}>

            {/* Submission header */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)' }}>
                    {selected.name}
                  </h2>
                  <a href={`mailto:${selected.email}`} style={{ fontSize: '13px', color: 'var(--gold2)', textDecoration: 'none' }}>
                    {selected.email}
                  </a>
                </div>
                {selected.replied ? (
                  <span style={{ fontSize: '12px', color: '#3DAF96', background: 'rgba(42,140,122,.1)', border: '1px solid rgba(42,140,122,.25)', borderRadius: '6px', padding: '4px 10px', flexShrink: 0 }}>
                    ✓ Replied
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#C9A84C', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: '6px', padding: '4px 10px', flexShrink: 0 }}>
                    Awaiting reply
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
                <CategoryBadge cat={selected.category} sub={selected.sub_option || undefined} />
                <span style={{ fontSize: '11px', color: 'rgba(213,226,235,.5)' }}>{formatDate(selected.created_at)}</span>
              </div>
            </div>

            {/* Message */}
            <div style={{
              background: 'rgba(245,237,216,.03)', border: '1px solid var(--hairline)',
              borderRadius: '10px', padding: '20px', marginBottom: '28px',
            }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '10px' }}>
                Message
              </div>
              <p style={{ fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selected.message}
              </p>
            </div>

            {/* Previous reply (if any) */}
            {selected.reply_body && (
              <div style={{
                background: 'rgba(42,140,122,.05)', border: '1px solid rgba(42,140,122,.18)',
                borderRadius: '10px', padding: '20px', marginBottom: '28px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3DAF96' }}>
                    Reply sent
                  </div>
                  {selected.replied_at && (
                    <div style={{ fontSize: '10px', color: 'rgba(213,226,235,.45)' }}>{formatDate(selected.replied_at)}</div>
                  )}
                </div>
                <p style={{ fontSize: '14px', color: 'var(--sand)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selected.reply_body}
                </p>
              </div>
            )}

            {/* Reply composer */}
            <div style={{
              background: 'rgba(245,237,216,.02)', border: '1px solid var(--hairline)',
              borderRadius: '10px', padding: '20px',
            }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '12px' }}>
                {selected.replied ? 'Send another reply' : 'Reply to user'}
              </div>

              <div style={{ fontSize: '12px', color: 'rgba(213,226,235,.5)', marginBottom: '10px' }}>
                To: <span style={{ color: 'var(--sand)' }}>{selected.name}</span> &lt;{selected.email}&gt;
              </div>

              <textarea
                value={reply}
                onChange={e => { setReply(e.target.value); setSendErr(''); setSendOk(false) }}
                placeholder="Write your reply here…"
                rows={8}
                style={{
                  width: '100%', background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.1)',
                  borderRadius: '8px', color: 'var(--sand2)', fontSize: '13px', padding: '12px 14px',
                  fontFamily: 'var(--font-sans)', lineHeight: 1.7, resize: 'vertical', outline: 'none',
                  minHeight: '140px', boxSizing: 'border-box',
                }}
              />

              <div style={{ fontSize: '11px', color: 'rgba(213,226,235,.4)', marginTop: '6px', marginBottom: '14px' }}>
                Sent via the Soul Space reply email template. The user will receive a branded email with your message.
              </div>

              {sendErr && (
                <div style={{
                  marginBottom: '12px', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.25)', color: '#D44040', fontSize: '13px',
                }}>
                  {sendErr}
                </div>
              )}

              {sendOk && (
                <div style={{
                  marginBottom: '12px', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.25)', color: '#3DAF96', fontSize: '13px',
                }}>
                  ✓ Reply sent to {selected.email}
                </div>
              )}

              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                style={{
                  padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer',
                  background: sending || !reply.trim() ? 'rgba(201,168,76,.25)' : 'var(--gold)',
                  color: sending || !reply.trim() ? 'rgba(8,17,28,.5)' : '#08111C',
                  border: 'none', transition: 'all .12s',
                }}
              >
                {sending ? 'Sending…' : 'Send reply →'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1 }}>{children}</div>
}

export default function AdminContact() {
  return (
    <Suspense fallback={<div style={{ padding: '28px 32px', color: 'var(--mist)' }}>Loading…</div>}>
      <ContactInner />
    </Suspense>
  )
}
