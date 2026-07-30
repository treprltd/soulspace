'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Branch, MirrorOutput, ResonanceTap } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { ResonanceTap as ResonanceTapComponent } from '@/components/session/ResonanceTap'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/analytics'

export default function MirrorOutputPage() {
  const router = useRouter()
  const [mirror, setMirror] = useState<MirrorOutput | null>(null)
  const [resonanceTap, setResonanceTap] = useState<ResonanceTap | undefined>()
  const [tapped, setTapped] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [correctionUsed, setCorrectionUsed] = useState(false)
  const [correctionError, setCorrectionError] = useState(false)
  const [mirrorVersion, setMirrorVersion] = useState(0)

  useEffect(() => {
    const stored = sessionStorage.getItem('ss_mirror')
    if (!stored) { router.push('/session'); return }
    setMirror(JSON.parse(stored) as MirrorOutput)
  }, [router])

  const handleTap = async (result: ResonanceTap) => {
    // Allow re-selection: user can switch between "accurate" and "not_quite"
    // before moving on. Each tap overwrites the stored value (API is idempotent).
    if (result === resonanceTap) return  // no-op if tapping the already-selected option
    setResonanceTap(result)
    setTapped(true)
    sessionStorage.setItem('ss_resonance', result)

    const sessionId = sessionStorage.getItem('ss_session_id')
    logEvent({ sessionId: sessionId ?? undefined, eventName: 'resonance_tapped', properties: { result } })
    if (sessionId) {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`
      }
      await fetch(`/api/sessions/${sessionId}/resonance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ result }),
      }).catch(() => {})
    }
  }

  const handleCorrection = async (text: string) => {
    setRegenerating(true)
    setCorrectionError(false)
    try {
      const branch = (sessionStorage.getItem('ss_branch') ?? 'A') as Branch
      const situation = sessionStorage.getItem('ss_situation') ?? undefined
      const emotions = JSON.parse(sessionStorage.getItem('ss_emotions') ?? '[]') as string[]
      const intensity = Number(sessionStorage.getItem('ss_intensity') ?? '5')
      const context = sessionStorage.getItem('ss_context') ?? ''
      const sessionId = sessionStorage.getItem('ss_session_id') ?? crypto.randomUUID()

      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`
      }

      const res = await fetch('/api/mirror/regenerate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          branch,
          emotionTags: emotions,
          intensity,
          contextText: context,
          ...(situation ? { situation } : {}),
          correctionContext: text,
        }),
      })

      const data = await res.json() as { crisis?: boolean; mirror?: MirrorOutput }

      if (data.crisis) { router.push('/crisis'); return }

      if (data.mirror) {
        setMirror(data.mirror)
        sessionStorage.setItem('ss_mirror', JSON.stringify(data.mirror))
        sessionStorage.removeItem('ss_resonance')
        setResonanceTap(undefined)
        setTapped(false)
        setCorrectionUsed(true)
        setMirrorVersion(v => v + 1)
        return
      }

      setCorrectionError(true)
    } catch {
      setCorrectionError(true)
    } finally {
      setRegenerating(false)
    }
  }

  const handleSeason = () => {
    router.push('/session/season')
  }

  if (!mirror) return null

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: 'var(--gold)' }}>Your reflection</span>} />

      <div className="session-outer-pad px-6 py-6 max-w-xl mx-auto animate-fade-in">

        {/* AFFIRMATION MOMENT 4 — frozen copy */}
        <div className="affirm-copy mb-5">
          This is not a diagnosis.<br />
          It is what seems to be here, from what you shared.
        </div>

        {/* Emotion echo */}
        {mirror.patternTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-8">
            {mirror.patternTags.map(tag => (
              <span key={tag} className="emotion-tag selected">{tag}</span>
            ))}
          </div>
        )}

        {/* Correction note — shown once, after a regenerated reflection */}
        {correctionUsed && (
          <p className="text-xs text-center mb-4" style={{ color: 'rgba(232,201,122,.8)' }}>
            Updated, based on what you shared.
          </p>
        )}

        {/* ── Mirror cards — staged reveal: each layer fades in after the previous ── */}
        {/* Body paragraphs: serif upright (not italic) at 16px — easier to read */}
        {/* key={mirrorVersion} forces a remount so the fade-in replays after a correction */}
        {/* ── Reflection — deliberate hierarchy so the eye lands on one thing ──
            Same content and labels as before; re-weighted, not rewritten:
            carrying = quiet lead-in, underneath = the insight (hero), question =
            calm anchor. Boxes are replaced with typographic weight + whitespace
            so an overwhelmed reader isn't met with three equal walls of text. */}
        <div key={mirrorVersion}>
          {/* Carrying — the context. Lighter and smaller: read as the set-up, not
              the conclusion. */}
          <div className="mb-6" style={{ animation: 'mirrorFadeIn 0.6s ease forwards' }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.8, marginBottom: '7px' }}>
              What you&apos;re carrying
            </div>
            <p className="font-serif" style={{ fontSize: '16px', lineHeight: '1.75', color: 'rgba(213,226,235,.6)' }}>
              {mirror.carrying}
            </p>
          </div>

          {/* Underneath — the insight. The visual centre of gravity: largest,
              brightest, framed by whitespace rather than a box. */}
          <div className="mb-7" style={{ opacity: 0, animation: 'mirrorFadeIn 0.6s ease 1.4s forwards' }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.8, marginBottom: '10px' }}>
              What appears underneath
            </div>
            <p className="font-serif" style={{ fontSize: '25px', lineHeight: '1.5', color: 'rgba(245,237,216,.95)' }}>
              {mirror.underneath}
            </p>
          </div>

          {/* Question — the calm anchor. Kept italic and teal; a light border-left
              instead of a full box so it doesn't compete with the insight. */}
          <div
            className="mb-5"
            style={{
              opacity: 0,
              animation: 'mirrorFadeIn 0.6s ease 2.6s forwards',
              borderLeft: '2px solid rgba(61,175,150,.5)',
              paddingLeft: '16px',
            }}
          >
            <div style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--teal2)', marginBottom: '7px' }}>
              One question back to you
            </div>
            <p className="font-serif italic text-sand2" style={{ fontSize: '20px', lineHeight: '1.6' }}>
              {mirror.question}
            </p>
          </div>
        </div>

        {/* ── AI transparency — just before "did this feel accurate?" ─────── */}
        <p
          className="text-center text-sm mb-5 leading-relaxed"
          style={{ color: 'rgba(213,226,235,.8)' }}
        >
          This reflection was shaped by AI from what you shared — not a diagnosis, not advice.
        </p>

        {/* ── Resonance tap — comes AFTER reading, not beside it ───────────── */}
        <ResonanceTapComponent
          onTap={handleTap}
          selected={resonanceTap}
          onCorrection={handleCorrection}
          regenerating={regenerating}
          correctionUsed={correctionUsed}
        />

        {/* Correction error — original reflection stays in place */}
        {correctionError && (
          <p className="text-xs text-center mb-3 -mt-1.5" style={{ color: 'rgba(213,226,235,.65)' }}>
            Couldn&apos;t update — your original reflection is still here.
          </p>
        )}

        {/* ── Season CTA ───────────────────────────────────────────────────── */}
        <button
          onClick={handleSeason}
          className="btn-primary w-full py-3.5 mt-4"
        >
          See your season →
        </button>

        {/* Safety notice — minimal, below the fold */}
        <div
          className="flex gap-2 items-start rounded-lg p-3 mt-5"
          style={{ background: 'rgba(42,140,122,.04)', border: '1px solid rgba(42,140,122,.1)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#3DAF96" strokeWidth="1.4" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
            <path d="M6 1l3.5 1.75v3.5C9.5 8.75 7.9 10.5 6 11c-1.9-.5-3.5-2.25-3.5-4.75v-3.5L6 1z" />
          </svg>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(213,226,235,.72)' }}>
            Soul Space is not a crisis service. If you&apos;re in distress,{' '}
            <span style={{ color: 'var(--teal2)' }}>please call or text 988.</span>
          </p>
        </div>

      </div>
    </main>
  )
}
