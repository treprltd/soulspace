'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

type AdminEnv = 'dev' | 'qa' | 'prod'

interface MirrorData {
  overall: { rate: number | null; accurate: number; total: number; targetMet: boolean | null }
  byBranch: Record<string, { accurate: number; total: number; rate: number | null }>
  bySeason: Record<string, { accurate: number; total: number; rate: number | null }>
  daily: { date: string; rate: number | null; total: number }[]
  byIntensity: Record<number, { accurate: number; total: number }>
  windowDays: number
}

const BRANCH_LABELS: Record<string, string> = {
  A: 'Decision Pressure', B: 'Something Unnamed',
  C: 'Pattern Repeating', D: 'Carrying Alone',
}
const BRANCH_COLORS = ['#6B8CAE', '#3DAF96', '#C9A84C', '#C4784A']

const SEASON_LABELS: Record<string, string> = {
  W: 'Winter', Sp: 'Spring', Su: 'Summer', Au: 'Autumn',
}
const SEASON_COLORS: Record<string, string> = {
  W: '#6B8CAE', Sp: '#3DAF96', Su: '#C9A84C', Au: '#C4784A',
}

function RateBar({ rate, total, label, color = 'var(--teal2)' }: {
  rate: number | null; total: number; label: string; color?: string
}) {
  const pct = rate ?? 0
  const metTarget = rate !== null && rate >= 60
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--sand)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>{total} tapped</span>
          <span style={{
            fontSize: '12px', fontWeight: 700, color: rate !== null ? (metTarget ? '#3DAF96' : '#D44040') : 'var(--mist)',
          }}>
            {rate !== null ? `${rate}%` : '—'}
          </span>
        </div>
      </div>
      <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(245,237,216,.06)', position: 'relative' }}>
        <div style={{
          height: '100%', borderRadius: '3px', width: `${Math.min(pct, 100)}%`,
          background: rate !== null ? (metTarget ? '#3DAF96' : '#D44040') : 'var(--mist)',
          transition: 'width .4s ease',
        }} />
        {/* 60% marker */}
        <div style={{
          position: 'absolute', top: '-3px', bottom: '-3px',
          left: '60%', width: '1px', background: 'rgba(245,237,216,.25)',
        }} />
      </div>
    </div>
  )
}

function MiniTrend({ daily }: { daily: MirrorData['daily'] }) {
  if (daily.length < 2) return (
    <div style={{ color: 'var(--mist)', fontSize: 'var(--fs-3xs)', padding: '20px 0' }}>
      Not enough data for trend
    </div>
  )

  const maxH = 60
  const w = Math.max(Math.floor(500 / daily.length), 8)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${maxH + 24}px`, padding: '0 4px', minWidth: `${daily.length * (w + 3)}px` }}>
        {daily.map((d, i) => {
          const pct = d.rate ?? 0
          const barH = Math.round((pct / 100) * maxH)
          const met = d.rate !== null && d.rate >= 60
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <div title={`${d.date}: ${d.rate ?? '—'}% (${d.total})`} style={{
                width: `${w}px`, height: `${barH}px`,
                background: d.rate === null ? 'rgba(245,237,216,.06)' : met ? 'rgba(61,175,150,.7)' : 'rgba(212,64,64,.7)',
                borderRadius: '2px 2px 0 0', cursor: 'default',
                minHeight: '2px',
              }} />
              <div style={{ fontSize: '8px', color: 'var(--mist)', marginTop: '3px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '18px' }}>
                {d.date.slice(5)}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--mist)', marginTop: '4px' }}>
        <span>0%</span>
        <span style={{ color: 'rgba(245,237,216,.4)' }}>— 60% target —</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function MirrorInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const env = (searchParams.get('env') ?? 'dev') as AdminEnv
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const [data, setData] = useState<MirrorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function setDays(d: number) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('days', String(d))
    router.push(`${pathname}?${p.toString()}`)
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/admin/mirror?env=${env}&days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [env, days])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>
            Mirror Quality · {env.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--sand2)', margin: 0 }}>
            Resonance Accuracy
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '6px 12px', fontSize: '12px', fontFamily: 'var(--font-sans)',
                background: days === d ? 'rgba(201,168,76,.15)' : 'var(--ink2)',
                border: `1px solid ${days === d ? 'rgba(201,168,76,.5)' : 'var(--hairline)'}`,
                borderRadius: 'var(--r-md)', color: days === d ? 'var(--gold2)' : 'var(--mist)',
                cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</p>}
      {error && <p style={{ color: '#D44040', fontSize: 'var(--fs-sm)' }}>Error: {error}</p>}

      {data && !loading && (
        <>
          {/* Overall hero stat */}
          <div style={{
            background: 'var(--ink2)',
            border: `1px solid ${data.overall.targetMet ? 'rgba(42,140,122,.4)' : data.overall.targetMet === false ? 'rgba(212,64,64,.4)' : 'var(--hairline)'}`,
            borderRadius: 'var(--r-xl)', padding: '24px 28px', marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                Overall Resonance Rate — last {days}d
              </div>
              <span style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                background: 'rgba(201,168,76,.14)', border: '1px solid rgba(201,168,76,.4)',
                color: 'var(--gold2)', fontWeight: 600,
              }}>
                KEY METRIC
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{
                fontSize: '56px', fontFamily: 'var(--font-serif)', fontWeight: 300, lineHeight: 1,
                color: data.overall.rate !== null
                  ? (data.overall.targetMet ? '#3DAF96' : '#D44040')
                  : 'var(--mist)',
              }}>
                {data.overall.rate !== null ? `${data.overall.rate}%` : '—'}
              </div>
              <div style={{ paddingBottom: '6px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--sand)', marginBottom: '2px', fontWeight: 500 }}>
                  {data.overall.targetMet === true && '✓ Target met (≥60%)'}
                  {data.overall.targetMet === false && '✕ Below 60% target — review Mirror prompts'}
                  {data.overall.targetMet === null && 'No data in this window'}
                </div>
                <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--mist)' }}>
                  {data.overall.accurate} accurate / {data.overall.total} tapped
                </div>
              </div>
            </div>

            {/* Big bar */}
            <div style={{ marginTop: '16px', height: '8px', borderRadius: '4px', background: 'rgba(245,237,216,.06)', position: 'relative' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${Math.min(data.overall.rate ?? 0, 100)}%`,
                background: data.overall.targetMet ? '#3DAF96' : data.overall.targetMet === false ? '#D44040' : 'var(--mist)',
                transition: 'width .5s ease',
              }} />
              <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', left: '60%', width: '2px', background: 'rgba(245,237,216,.3)' }} />
            </div>

            {data.overall.targetMet === false && (
              <div style={{
                marginTop: '16px', padding: '10px 14px', borderRadius: 'var(--r-md)',
                background: 'rgba(212,64,64,.06)', border: '1px solid rgba(212,64,64,.2)',
                fontSize: 'var(--fs-3xs)', color: '#D44040', lineHeight: 1.6,
              }}>
                ⚠ Phase 1 rule: if resonance accuracy drops below 50%, stop all work and fix the Mirror. Current rate is {data.overall.rate}%.
              </div>
            )}
          </div>

          {/* Per-branch + per-season row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>

            {/* By Branch */}
            <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '18px 20px' }}>
              <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px' }}>
                By Branch
              </div>
              {(['A', 'B', 'C', 'D'] as const).map((b, i) => {
                const bv = data.byBranch[b]
                if (!bv) return <RateBar key={b} label={`Branch ${b} — ${BRANCH_LABELS[b]}`} rate={null} total={0} color={BRANCH_COLORS[i]} />
                return <RateBar key={b} label={`Branch ${b} — ${BRANCH_LABELS[b]}`} rate={bv.rate} total={bv.total} color={BRANCH_COLORS[i]} />
              })}
            </div>

            {/* By Season */}
            <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '18px 20px' }}>
              <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px' }}>
                By Season Assigned
              </div>
              {(['W', 'Sp', 'Su', 'Au'] as const).map(s => {
                const sv = data.bySeason[s]
                if (!sv) return <RateBar key={s} label={`${SEASON_LABELS[s]}`} rate={null} total={0} color={SEASON_COLORS[s]} />
                return <RateBar key={s} label={`${SEASON_LABELS[s]}`} rate={sv.rate} total={sv.total} color={SEASON_COLORS[s]} />
              })}
            </div>
          </div>

          {/* Daily trend */}
          <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '18px 20px', marginBottom: '20px' }}>
            <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
              Daily Resonance Trend — last {days}d
            </div>
            <MiniTrend daily={data.daily} />
          </div>

          {/* Intensity correlation */}
          <div style={{ background: 'var(--ink2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '18px 20px' }}>
            <div style={{ fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
              Resonance by Intensity (1–10)
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(intensity => {
                const iv = data.byIntensity[intensity]
                const rate = iv && iv.total > 0 ? Math.round((iv.accurate / iv.total) * 100) : null
                const barH = rate !== null ? Math.round((rate / 100) * 70) : 4
                const met = rate !== null && rate >= 60
                return (
                  <div key={intensity} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      title={`Intensity ${intensity}: ${rate ?? '—'}% (${iv?.total ?? 0} sessions)`}
                      style={{
                        width: '100%', height: `${barH}px`, minHeight: '4px',
                        background: rate === null ? 'rgba(245,237,216,.06)' : met ? 'rgba(61,175,150,.7)' : 'rgba(201,168,76,.7)',
                        borderRadius: '2px 2px 0 0', cursor: 'default',
                      }}
                    />
                    <div style={{ fontSize: '9px', color: 'var(--mist)', marginTop: '4px' }}>{intensity}</div>
                    {rate !== null && (
                      <div style={{ fontSize: '9px', color: met ? '#3DAF96' : '#C9A84C' }}>{rate}%</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LoadingShell() {
  return <div style={{ padding: '28px 32px', color: 'var(--mist)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
}

export default function MirrorPage() {
  return <Suspense fallback={<LoadingShell />}><MirrorInner /></Suspense>
}
