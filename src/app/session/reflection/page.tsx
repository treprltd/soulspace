'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MirrorOutput, ResonanceTap } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { ResonanceTap as ResonanceTapComponent } from '@/components/session/ResonanceTap'
import { createClient } from '@/lib/supabase/client'

export default function MirrorOutputPage() {
  const router = useRouter()
  const [mirror, setMirror] = useState<MirrorOutput | null>(null)
  const [resonanceTap, setResonanceTap] = useState<ResonanceTap | undefined>()
  const [tapped, setTapped] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('ss_mirror')
    if (!stored) { router.push('/session'); return }
    setMirror(JSON.parse(stored) as MirrorOutput)
  }, [router])

  const handleTap = async (result: ResonanceTap) => {
    if (tapped) return
    setResonanceTap(result)
    setTapped(true)
    sessionStorage.setItem('ss_resonance', result)

    const sessionId = sessionStorage.getItem('ss_session_id')
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

  const handleSeason = () => {
    router.push('/session/season')
  }

  if (!mirror) return null

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: 'var(--gold)' }}>Your reflection</span>} />

      <div className="px-6 py-6 max-w-xl mx-auto animate-fade-in">

        {/* AFFIRMATION MOMENT 4 — frozen copy */}
        <div className="affirm-copy mb-5">
          This is not a diagnosis.<br />
          It is what seems to be here, from what you shared.
        </div>

        {/* Emotion echo */}
        {mirror.patternTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {mirror.patternTags.map(tag => (
              <span key={tag} className="emotion-tag selected">{tag}</span>
            ))}
          </div>
        )}

        {/* ── Mirror cards — stacked single column ─────────────────────────── */}
        <div className="mirror-card mb-3">
          <div className="mirror-label text-gold uppercase mb-2.5">
            What you&apos;re carrying
          </div>
          <p className="font-serif italic text-sand leading-relaxed" style={{ fontSize: '15px' }}>
            {mirror.carrying}
          </p>
        </div>

        <div className="mirror-card mb-3">
          <div className="mirror-label text-gold uppercase mb-2.5">
            What appears underneath
          </div>
          <p className="font-serif italic text-sand leading-relaxed" style={{ fontSize: '15px' }}>
            {mirror.underneath}
          </p>
        </div>

        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)' }}
        >
          <div className="mirror-label uppercase mb-2.5" style={{ color: 'var(--teal2)' }}>
            One question back to you
          </div>
          <p className="font-serif italic text-sand2 leading-relaxed" style={{ fontSize: '15px' }}>
            {mirror.question}
          </p>
        </div>

        {/* ── Resonance tap — comes AFTER reading, not beside it ───────────── */}
        <ResonanceTapComponent onTap={handleTap} selected={resonanceTap} />

        {/* ── Season CTA ───────────────────────────────────────────────────── */}
        <button
          onClick={handleSeason}
          className="btn-primary w-full py-3.5 mt-4"
        >
          See your season →
        </button>

        {/* Non-clinical notice — minimal, below the fold */}
        <div
          className="flex gap-2 items-start rounded-lg p-3 mt-5"
          style={{ background: 'rgba(42,140,122,.04)', border: '1px solid rgba(42,140,122,.1)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#3DAF96" strokeWidth="1.4" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
            <path d="M6 1l3.5 1.75v3.5C9.5 8.75 7.9 10.5 6 11c-1.9-.5-3.5-2.25-3.5-4.75v-3.5L6 1z" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(139,167,184,.55)' }}>
            Descriptive only — not diagnostic. If you&apos;re in distress,{' '}
            <span style={{ color: 'var(--teal2)' }}>please reach out for human support.</span>
          </p>
        </div>

      </div>
    </main>
  )
}
