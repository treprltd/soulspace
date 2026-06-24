'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MirrorOutput } from '@/types'
import { NavBar } from '@/components/ui/NavBar'
import { getSeason } from '@/lib/seasons'
import { SeasonVisual } from '@/components/session/SeasonVisual'
import { logEvent } from '@/lib/analytics'
import { IconBadge, GroundingIcon, SeasonReflectionIcon, ReturnIcon } from '@/components/session/SectionIcons'

export default function SeasonCard() {
  const router = useRouter()
  const [mirror, setMirror] = useState<MirrorOutput | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('ss_mirror')
    if (!stored) { router.push('/session'); return }
    const m = JSON.parse(stored) as MirrorOutput
    if (m.safetyFlagged) { router.push('/crisis'); return }
    setMirror(m)
    logEvent({
      sessionId: sessionStorage.getItem('ss_session_id') ?? undefined,
      eventName: 'season_shown',
      properties: { season: m.season },
    })
  }, [router])

  if (!mirror) return null

  const season = getSeason(mirror.season)

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: season.color }}>Your season</span>} />
      <div className="session-outer-pad px-6 py-5 max-w-xl mx-auto animate-fade-in">

        {/* Season orientation — what "seasons" means */}
        <p className="text-sm text-center mb-4 leading-relaxed" style={{ color: 'rgba(213,226,235,.85)' }}>
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

          {/* Season visual — small animated scene (placeholder for illustrated art) */}
          <div className="flex justify-center mb-4">
            <SeasonVisual season={mirror.season} size={92} />
          </div>

          <div className="text-xs tracking-[.14em] uppercase text-center mb-1.5" style={{ color: season.color }}>
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
              { label: 'Grounding', text: season.grounding, Icon: GroundingIcon },
              { label: 'Reflection', text: season.reflection, Icon: SeasonReflectionIcon },
              { label: 'Return', text: season.returnPrompt, Icon: ReturnIcon },
            ].map(({ label, text, Icon }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-3 sm:px-3"
                style={{
                  background: `${season.color}08`,
                  border: `1px solid ${season.color}22`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <IconBadge background={`${season.color}1A`} size={22}>
                    <Icon color={season.color} />
                  </IconBadge>
                  <div className="season-tile-label text-[11px] tracking-[.1em] uppercase" style={{ color: season.color }}>
                    {label}
                  </div>
                </div>
                <p className="season-tile-body text-sm text-sand leading-relaxed">{text}</p>
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
