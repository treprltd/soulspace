'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'
import { AdminEnvNotConfigured } from '@/components/ui/AdminEnvNotConfigured'

interface User {
  id:                 string
  email:              string
  first_name:         string | null
  last_name:          string | null
  phone:              string | null
  dob:                string | null
  gender:             string | null
  profile_complete:   boolean
  created_at:         string
  plan_tier:          string
  age_bracket:        string | null
  stripe_customer_id: string | null
  session_count:      number
}

const GENDER_LABELS: Record<string, string> = {
  male:              'Man',
  female:            'Woman',
  non_binary:        'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
}

function calcAge(dob: string | null): string {
  if (!dob) return '—'
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return String(age)
}

interface UsersResponse {
  users: User[]
  total: number
  page: number
  pages: number
}

const PLAN_COLORS: Record<string, { color: string; bg: string }> = {
  free:       { color: 'var(--mist)',  bg: 'rgba(213,226,235,.52)' },
  essentials: { color: '#C9A84C',     bg: 'rgba(201,168,76,.12)'  },
  insights:   { color: '#3DAF96',     bg: 'rgba(42,140,122,.12)'  },
}

function UsersInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const plan = searchParams.get('plan') ?? ''
  const q = searchParams.get('q') ?? ''

  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [search, setSearch] = useState(q)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [savingPlan, setSavingPlan] = useState<string | null>(null)

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.set('page', '1')
    router.push(`${pathname}?${p.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setParam('q', search)
  }

  async function updatePlan(userId: string, newPlan: string) {
    setSavingPlan(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, plan_tier: newPlan, env }),
      })
      if (res.ok) {
        setData(prev => prev ? {
          ...prev,
          users: prev.users.map(u => u.id === userId ? { ...u, plan_tier: newPlan } : u),
        } : prev)
        setEditingUser(null)
      }
    } finally {
      setSavingPlan(null)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    setNotConfigured(false)
    const params = new URLSearchParams({ env, page: String(page) })
    if (plan) params.set('plan', plan)
    if (q) params.set('q', q)
    fetch(`/api/admin/users?${params}`)
      .then(r => r.json())
      .then(d => { if (d.not_configured) { setNotConfigured(true); return }; if (d.error) throw new Error(d.error); setNotConfigured(false); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, page, plan, q])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
          Users · {env.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
          User Management
        </h1>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <form onSubmit={submitSearch} style={{ display: 'flex', gap: '6px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email…"
            style={{
              padding: '8px 12px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
              background: 'var(--ink2)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)', color: 'var(--sand)', outline: 'none', width: '220px',
            }}
          />
          <button type="submit" style={filterBtn(false)}>Search</button>
          {q && (
            <button type="button" onClick={() => { setSearch(''); setParam('q', '') }} style={filterBtn(false)}>
              Clear ✕
            </button>
          )}
        </form>

        {/* Plan filter */}
        {(['', 'free', 'essentials', 'insights'] as const).map(p => (
          <button
            key={p}
            onClick={() => setParam('plan', p)}
            style={filterBtn(plan === p)}
          >
            {p || 'All Plans'}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        {data && (
          <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>
            {data.total.toLocaleString()} users
          </span>
        )}
      </div>

      {loading && <p style={{ color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</p>}
      {notConfigured && <AdminEnvNotConfigured env={env} />}
      {!notConfigured && error && <p style={{ color: '#D44040', fontSize: 'var(--fs-sm)' }}>Error: {error}</p>}

      {data && !loading && data.users.length === 0 && (
        <div style={{
          padding: '32px', textAlign: 'center', background: 'var(--ink2)',
          border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)',
          color: 'var(--mist)', fontSize: 'var(--fs-sm)',
        }}>
          No users found.
        </div>
      )}

      {data && !loading && data.users.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-3xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                  {['Name', 'Email', 'Phone', 'Age', 'Gender', 'Plan', 'Profile', 'Sessions', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--gold)', fontWeight: 500, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => {
                  const pc = PLAN_COLORS[u.plan_tier] ?? PLAN_COLORS.free
                  const isEditing = editingUser === u.id
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                      {/* Name */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {u.first_name || u.last_name ? (
                          <span style={{ color: 'var(--sand)', fontSize: '12px' }}>
                            {[u.first_name, u.last_name].filter(Boolean).join(' ')}
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(213,226,235,.60)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      {/* Email */}
                      <td style={{ padding: '10px 12px', color: 'var(--sand)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </td>
                      {/* Phone */}
                      <td style={{ padding: '10px 12px', color: 'var(--mist)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {u.phone ?? <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}
                      </td>
                      {/* Age (calculated from DOB) */}
                      <td style={{ padding: '10px 12px', color: 'var(--mist)', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {u.dob
                          ? <span style={{ color: 'var(--sand)' }}>{calcAge(u.dob)}</span>
                          : <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}
                      </td>
                      {/* Gender */}
                      <td style={{ padding: '10px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {u.gender
                          ? <span style={{ color: 'var(--mist)' }}>{GENDER_LABELS[u.gender] ?? u.gender}</span>
                          : <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}
                      </td>
                      {/* Plan */}
                      <td style={{ padding: '10px 12px' }}>
                        {isEditing ? (
                          <select
                            defaultValue={u.plan_tier}
                            onChange={e => updatePlan(u.id, e.target.value)}
                            disabled={savingPlan === u.id}
                            autoFocus
                            onBlur={() => setEditingUser(null)}
                            style={{
                              padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-sans)',
                              background: 'var(--ink3)', border: '1px solid var(--gold-25)',
                              borderRadius: 'var(--r-sm)', color: 'var(--sand)', outline: 'none',
                            }}
                          >
                            <option value="free">Free</option>
                            <option value="essentials">Essentials</option>
                            <option value="insights">Insights</option>
                          </select>
                        ) : (
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                            color: pc.color, background: pc.bg, fontWeight: 600, letterSpacing: '0.06em',
                          }}>
                            {u.plan_tier}
                          </span>
                        )}
                      </td>
                      {/* Profile complete */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                          color: u.profile_complete ? '#3DAF96' : 'rgba(213,226,235,.72)',
                          background: u.profile_complete ? 'rgba(42,140,122,.12)' : 'rgba(139,167,184,.07)',
                        }}>
                          {u.profile_complete ? '✓' : '—'}
                        </span>
                      </td>
                      {/* Sessions */}
                      <td style={{ padding: '10px 12px', color: 'var(--sand)', textAlign: 'center' }}>
                        {u.session_count}
                      </td>
                      {/* Joined */}
                      <td style={{ padding: '10px 12px', color: 'var(--mist)', whiteSpace: 'nowrap' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {!isEditing && (
                          <button
                            onClick={() => setEditingUser(u.id)}
                            style={{
                              padding: '4px 10px', fontSize: '11px', fontFamily: 'var(--font-sans)',
                              background: 'transparent', border: '1px solid var(--hairline)',
                              borderRadius: 'var(--r-sm)', color: 'var(--mist)',
                              cursor: 'pointer',
                            }}
                          >
                            Edit plan
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} style={pageBtn(page <= 1)}>← Prev</button>
              <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>{page} / {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))} style={pageBtn(page >= data.pages)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '7px 13px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
  background: active ? 'rgba(201,168,76,.12)' : 'var(--ink2)',
  border: `1px solid ${active ? 'rgba(201,168,76,.45)' : 'var(--hairline)'}`,
  borderRadius: 'var(--r-md)', color: active ? 'var(--gold2)' : 'var(--mist)',
  cursor: 'pointer',
})

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '7px 14px', fontSize: 'var(--fs-3xs)', fontFamily: 'var(--font-sans)',
  background: 'var(--ink2)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)', color: disabled ? 'var(--mist)' : 'var(--sand)',
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
})

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function UsersPage() {
  return <Suspense fallback={<LoadingShell />}><UsersInner /></Suspense>
}
