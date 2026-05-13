'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MirrorOutput, ResonanceTap } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { ResonanceTap as ResonanceTapComponent } from '@/components/session/ResonanceTap'

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
      await fetch(`/api/sessions/${sessionId}/resonance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      }).catch(() => {})
    }
  }

  const handleSeason = () => {
    router.push('/session/season')
  }

  if (!mirror) return null

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: 'var(--gold)' }}>Your reflection</span>} />
      <div className="px-6 py-5 max-w-2xl mx-auto animate-fade-in">
        {/* AFFIRMATION MOMENT 4 — frozen copy */}
        <div className="affirm-copy mb-4">
          This is not a diagnosis.<br />
          It is what seems to be here, from what you shared.
        </div>

        <h2 className="font-serif font-light text-sand2 text-2xl mb-2 leading-tight">
          Here is what <em className="text-gold2">seems to be present.</em>
        </h2>

        {/* Emotion tags echoed */}
        {mirror.patternTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 mb-5">
            {mirror.patternTags.map(tag => (
              <span key={tag} className="emotion-tag selected">{tag}</span>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Mirror cards */}
          <div>
            <div className="mirror-card">
              <div className="micro-label" style={{ marginBottom: '8px' }}>
                What you&apos;re carrying
              </div>
              <p className="font-serif italic text-sand leading-relaxed" style={{ fontSize: '13px' }}>
                {mirror.carrying}
              </p>
            </div>

            <div className="mirror-card">
              <div className="micro-label" style={{ marginBottom: '8px' }}>
                What appears underneath
              </div>
              <p className="font-serif italic text-sand leading-relaxed" style={{ fontSize: '13px' }}>
                {mirror.underneath}
              </p>
            </div>

            <div className="rounded-xl p-3 mb-2.5" style={{ background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)' }}>
              <div className="micro-label" style={{ marginBottom: '8px', color: 'var(--teal2)' }}>
                One question back to you
              </div>
              <p className="font-serif italic text-sand2 leading-snug" style={{ fontSize: '12px' }}>
                {mirror.question}
              </p>
            </div>

            {/* Non-clinical notice */}
            <div
              className="flex gap-1.5 items-start rounded-lg p-2.5 mt-2.5"
              style={{ background: 'rgba(42,140,122,.05)', border: '1px solid rgba(42,140,122,.14)' }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#3DAF96" strokeWidth="1.4" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                <path d="M6 1l3.5 1.75v3.5C9.5 8.75 7.9 10.5 6 11c-1.9-.5-3.5-2.25-3.5-4.75v-3.5L6 1z" />
              </svg>
              <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.55)' }}>
                Descriptive only — not diagnostic. If you&apos;re in distress,{' '}
                <span style={{ color: 'var(--teal2)' }}>please reach out for human support.</span>
              </p>
            </div>
          </div>

          {/* Right: Resonance tap + Season CTA */}
          <div>
            <ResonanceTapComponent onTap={handleTap} selected={resonanceTap} />

            <div
              className="rounded-xl p-3 mb-3"
              style={{ background: 'var(--SpB)', border: '1px solid rgba(42,140,122,.2)' }}
            >
              <div className="text-[7px] tracking-[.1em] uppercase mb-1" style={{ color: 'var(--Sp)' }}>
                What comes next
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--SpS)' }}>
                Soul Space will show you which season this may feel like — simple language, clinically reviewed.
              </p>
            </div>

            <button onClick={handleSeason} className="btn-primary w-full text-xs">
              See your season →
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
