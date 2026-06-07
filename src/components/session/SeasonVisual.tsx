'use client'

// SeasonVisual — a small animated "scene" per season, standing in for real
// illustrated artwork. Beta research (Theme 8) named the season screen's bare
// icon as a gap: "Season needs a real visual, not an icon" (Dan), "I would add
// a short onboarding animation, problem to reflection to season to action"
// (Dan again). Built entirely in CSS/SVG — no external assets — so it ships
// now and can be swapped for commissioned art later without touching layout.
//
// Each scene uses the season's existing approved palette (src/lib/seasons)
// and a few looping CSS animations (see globals.css `.season-*` classes) to
// suggest motion: drifting snow, swaying branches, falling leaves, rising
// warmth — purely decorative, never altering the verbatim season copy.

import type { Season } from '@/types'

interface SeasonVisualProps {
  season: Season
  size?: number
}

export function SeasonVisual({ season, size = 96 }: SeasonVisualProps) {
  const scenes: Record<Season, React.ReactNode> = {
    W: <WinterScene />,
    Sp: <SpringScene />,
    Su: <SummerScene />,
    Au: <AutumnScene />,
  }

  return (
    <div
      data-testid="season-visual"
      data-season={season}
      className="relative overflow-hidden rounded-full flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {scenes[season]}
    </div>
  )
}

// ── Winter — slow drifting snow over a still horizon ───────────────────────
function WinterScene() {
  const flakes = [
    { left: '20%', delay: '0s',   size: 3 },
    { left: '45%', delay: '1.6s', size: 2 },
    { left: '65%', delay: '3.1s', size: 3 },
    { left: '32%', delay: '4.4s', size: 2 },
    { left: '78%', delay: '0.8s', size: 2 },
  ]
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 65%, rgba(107,140,174,.16), transparent 70%)' }}>
      <div className="absolute inset-0 season-drift" style={{ opacity: .5 }}>
        <div className="absolute left-0 right-0" style={{ bottom: '28%', height: 1, background: 'rgba(107,140,174,.35)' }} />
      </div>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="absolute rounded-full season-fall"
          style={{
            left: f.left,
            top: 0,
            width: f.size,
            height: f.size,
            background: '#C8DCF0',
            animationDelay: f.delay,
          }}
        />
      ))}
      <span className="absolute inset-0 m-auto rounded-full season-twinkle" style={{ width: 14, height: 14, background: 'rgba(200,220,240,.18)' }} />
    </div>
  )
}

// ── Spring — a sprout rising, gentle upward energy ─────────────────────────
function SpringScene() {
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 70%, rgba(42,140,122,.18), transparent 70%)' }}>
      <svg viewBox="0 0 44 44" width="100%" height="100%" className="absolute inset-0">
        <g className="season-rise" style={{ transformOrigin: '22px 30px' }}>
          <path d="M22 34V20" stroke="#7ABDA0" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <path d="M22 24c-3-3-7-2-8 1 4 2 7 0 8-1z" fill="#2A8C7A" opacity=".75" />
          <path d="M22 21c3-3 7-2 8 1-4 2-7 0-8-1z" fill="#7ABDA0" opacity=".7" />
          <circle cx="22" cy="17" r="2.2" fill="#B8E8D4" />
        </g>
        <line x1="10" y1="34" x2="34" y2="34" stroke="rgba(42,140,122,.3)" strokeWidth="1" />
      </svg>
      <span className="absolute rounded-full season-twinkle" style={{ left: '28%', top: '30%', width: 3, height: 3, background: '#B8E8D4' }} />
      <span className="absolute rounded-full season-twinkle" style={{ left: '68%', top: '42%', width: 2, height: 2, background: '#7ABDA0', animationDelay: '1.2s' }} />
    </div>
  )
}

// ── Summer — steady sun with slow radiating warmth ─────────────────────────
function SummerScene() {
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,.2), transparent 72%)' }}>
      <svg viewBox="0 0 44 44" width="100%" height="100%" className="absolute inset-0">
        <circle cx="22" cy="22" r="7" fill="#C9A84C" opacity=".85" />
        <circle cx="22" cy="22" r="11" stroke="rgba(201,168,76,.25)" strokeWidth="1" fill="none" className="season-twinkle" />
        <g className="season-twinkle" style={{ animationDuration: '4s' }}>
          <path d="M22 6v4M22 34v4M6 22h4M34 22h4M11 11l3 3M30 30l3 3M33 11l-3 3M14 30l-3 3"
            stroke="#E8C97A" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}

// ── Autumn — leaves slowly falling from a leaning branch ───────────────────
function AutumnScene() {
  const leaves = [
    { left: '30%', delay: '0s',   color: '#C4784A' },
    { left: '52%', delay: '2.3s', color: '#E0A468' },
    { left: '68%', delay: '4.6s', color: '#C4784A' },
  ]
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 60%, rgba(196,120,74,.16), transparent 70%)' }}>
      <svg viewBox="0 0 44 44" width="36" height="36" className="absolute season-sway" style={{ left: 6, top: 2 }}>
        <path d="M6 6c8 2 14 8 16 18" stroke="#C4784A" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".55" />
      </svg>
      {leaves.map((l, i) => (
        <span
          key={i}
          className="absolute season-fall"
          style={{ left: l.left, top: '18%', animationDelay: l.delay }}
        >
          <svg viewBox="0 0 12 12" width="7" height="7">
            <path d="M6 0c4 2 6 6 0 12-6-6-4-10 0-12z" fill={l.color} opacity=".8" />
          </svg>
        </span>
      ))}
    </div>
  )
}
