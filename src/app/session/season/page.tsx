'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MirrorOutput } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { getSeason } from '@/lib/seasons'

// Season icon configs — larger SVGs with an ambient radial glow behind them
const SEASON_GLOW: Record<string, string> = {
  W:  'rgba(107,140,174,.15)',
  Sp: 'rgba(42,140,122,.15)',
  Su: 'rgba(201,168,76,.15)',
  Au: 'rgba(196,120,74,.15)',
}

const SEASON_ICONS: Record<string, React.ReactNode> = {
  W: (
    <svg width="56" height="56" viewBox="0 0 44 44" fill="none" stroke="#6B8CAE" strokeWidth="1.1" strokeLinecap="round">
      <path d="M22 4v36M4 22h36M8.5 8.5l27 27M35.5 8.5l-27 27" />
      <circle cx="22" cy="22" r="4" fill="rgba(107,140,174,.12)" />
      {/* Outer faint ring */}
      <circle cx="22" cy="22" r="10" stroke="rgba(107,140,174,.15)" strokeWidth="0.8" />
    </svg>
  ),
  Sp: (
    <svg width="56" height="56" viewBox="0 0 44 44" fill="none" stroke="#2A8C7A" strokeWidth="1.1" strokeLinecap="round">
      <path d="M22 40V18M15 25l7-7 7 7" />
      <path d="M10 36c0-9 5-15 12-17M34 36c0-9-5-15-12-17" />
      <circle cx="22" cy="10" r="3.5" fill="rgba(42,140,122,.18)" />
      {/* Upward energy lines */}
      <path d="M22 40V34" strokeWidth="0.6" stroke="rgba(42,140,122,.3)" />
    </svg>
  ),
  Su: (
    <svg width="56" height="56" viewBox="0 0 44 44" fill="none" stroke="#C9A84C" strokeWidth="1.1" strokeLinecap="round">
      <circle cx="22" cy="22" r="7" fill="rgba(201,168,76,.1)" />
      {/* Outer glow ring */}
      <circle cx="22" cy="22" r="12" stroke="rgba(201,168,76,.08)" strokeWidth="0.8" />
      <path d="M22 5v4M22 35v4M5 22h4M35 22h4M10 10l3 3M31 31l3 3M34 10l-3 3M13 31l-3 3" />
    </svg>
  ),
  Au: (
    <svg width="56" height="56" viewBox="0 0 44 44" fill="none" stroke="#C4784A" strokeWidth="1.1" strokeLinecap="round">
      <path d="M14 38c0-12 7-20 18-22-2 8-7 14-18 22z" fill="rgba(196,120,74,.08)" />
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
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: season.color }}>Your season</span>} />
      <div className="session-outer-pad px-6 py-5 max-w-xl mx-auto animate-fade-in">

        {/* Season orientation — what "seasons" means */}
        <p className="text-sm text-center mb-4 leading-relaxed" style={{ color: 'rgba(139,167,184,.55)' }}>
          A season is not a diagnosis — it&apos;s a way of describing what this emotional moment might feel like.
        </p>

        {/* Season card */}
        <div
          className="rounded-2xl p-6 mb-4 relative overflow-hidden"
          style={{ background: season.bgColor, border: `1px solid ${season.borderColor}` }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-60"
            style={{ background: `linear-gradient(90deg, transparent, ${season.color}, transparent)` }}
          />

          {/* Season icon with ambient radial glow */}
          <div className="flex justify-center mb-4">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 80,
                height: 80,
                background: `radial-gradient(circle, ${SEASON_GLOW[mirror.season]}, transparent 72%)`,
              }}
            >
              {SEASON_ICONS[mirror.season]}
            </div>
          </div>

          <div className="text-[9px] tracking-[.14em] uppercase text-center mb-1.5" style={{ color: season.color }}>
            Your current season
          </div>
          <h2 className="font-serif font-light text-center text-3xl mb-2 leading-tight" style={{ color: season.textColor }}>
            This may feel like <em>{season.name}.</em>
          </h2>
          <p className="text-center font-light leading-loose max-w-md mx-auto mb-4" style={{ fontSize: '15px', color: season.secondaryColor }}>
            {season.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { label: 'Grounding', text: season.grounding },
              { label: 'Reflection', text: season.reflection },
              { label: 'Return', text: season.returnPrompt },
            ].map(({ label, text }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-3 sm:px-3"
                style={{
                  background: `${season.color}08`,
                  border: `1px solid ${season.color}22`,
                }}
              >
                <div className="season-tile-label text-[9px] tracking-[.1em] uppercase mb-2" style={{ color: season.color }}>
                  {label}
                </div>
                <p className="season-tile-body text-[12px] text-sand leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => router.push('/session/next-step')}
          className="btn-primary w-full py-3.5"
        >
          Choose your next step →
        </button>
      </div>
    </main>
  )
}
