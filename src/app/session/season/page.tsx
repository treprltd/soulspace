'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MirrorOutput } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { getSeason } from '@/lib/seasons'

const SEASON_ICONS: Record<string, React.ReactNode> = {
  W: (
    <svg width="38" height="38" viewBox="0 0 44 44" fill="none" stroke="#6B8CAE" strokeWidth="1.2" strokeLinecap="round">
      <path d="M22 4v36M4 22h36M8.5 8.5l27 27M35.5 8.5l-27 27" />
      <circle cx="22" cy="22" r="4" />
    </svg>
  ),
  Sp: (
    <svg width="38" height="38" viewBox="0 0 44 44" fill="none" stroke="#2A8C7A" strokeWidth="1.2" strokeLinecap="round">
      <path d="M22 40V18M15 25l7-7 7 7" />
      <path d="M10 36c0-9 5-15 12-17M34 36c0-9-5-15-12-17" />
      <circle cx="22" cy="10" r="3" />
    </svg>
  ),
  Su: (
    <svg width="38" height="38" viewBox="0 0 44 44" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="22" cy="22" r="7" />
      <path d="M22 5v4M22 35v4M5 22h4M35 22h4M10 10l3 3M31 31l3 3M34 10l-3 3M13 31l-3 3" />
    </svg>
  ),
  Au: (
    <svg width="38" height="38" viewBox="0 0 44 44" fill="none" stroke="#C4784A" strokeWidth="1.2" strokeLinecap="round">
      <path d="M14 38c0-12 7-20 18-22-2 8-7 14-18 22z" />
      <path d="M26 34c0-8 5-13 14-14" />
      <path d="M22 38V26M18 32l4-6 4 6" />
    </svg>
  ),
}

export default function SeasonCard() {
  const router = useRouter()
  const [mirror, setMirror] = useState<MirrorOutput | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('ss_mirror')
    if (!stored) { router.push('/session'); return }
    const m = JSON.parse(stored) as MirrorOutput
    if (m.safetyFlagged) { router.push('/crisis'); return }
    setMirror(m)
  }, [router])

  if (!mirror) return null

  const season = getSeason(mirror.season)

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: season.color }}>Your season</span>} />
      <div className="px-6 py-5 max-w-xl mx-auto animate-fade-in">
        {/* Clinical badge */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] mb-4"
          style={{ background: 'rgba(42,140,122,.07)', border: '1px solid rgba(42,140,122,.22)', color: 'var(--teal2)' }}
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M6 1l3.5 1.75v3.5C9.5 8.75 7.9 10.5 6 11c-1.9-.5-3.5-2.25-3.5-4.75v-3.5L6 1z" />
          </svg>
          Clinically reviewed · Dr. Sofia Georgiadou · March 2026 · Verbatim — do not modify
        </div>

        {/* Season card */}
        <div
          className="rounded-2xl p-6 mb-4 relative overflow-hidden"
          style={{ background: season.bgColor, border: `1px solid ${season.borderColor}` }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-60"
            style={{ background: `linear-gradient(90deg, transparent, ${season.color}, transparent)` }}
          />

          <div className="flex justify-center mb-3">{SEASON_ICONS[mirror.season]}</div>

          <div className="text-[7px] tracking-[.14em] uppercase text-center mb-1.5" style={{ color: season.color }}>
            Your current season
          </div>
          <h2 className="font-serif font-light text-center text-3xl mb-2 leading-tight" style={{ color: season.textColor }}>
            This may feel like <em>{season.name}.</em>
          </h2>
          <p className="text-[11px] text-center font-light leading-loose max-w-md mx-auto mb-4" style={{ color: season.secondaryColor }}>
            {season.description}
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Grounding', text: season.grounding },
              { label: 'Reflection', text: season.reflection },
              { label: 'Return', text: season.returnPrompt },
            ].map(({ label, text }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2.5"
                style={{
                  background: `${season.color}08`,
                  border: `1px solid ${season.color}22`,
                }}
              >
                <div className="text-[7px] tracking-[.1em] uppercase mb-1.5" style={{ color: season.color }}>
                  {label}
                </div>
                <p className="text-[10px] text-sand leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button onClick={() => router.push('/session/next-step')} className="btn-primary">
            Choose your next step →
          </button>
        </div>
      </div>
    </main>
  )
}
