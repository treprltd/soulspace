'use client'

import { useState } from 'react'

// ── Phase 2 / Phase 3 concept previews ─────────────────────────────────────
// Shown at the end of the experience to beta users, to learn which future
// direction would actually make people return BEFORE we build it. Each card is
// a short preview (video slot) + a three-way reaction + one optional open
// question. Reactions are stored via /api/phase-interest (table: phase_interest,
// migration 024).
//
// NOTE: the preview videos don't exist yet — the video slot shows a labelled
// placeholder until a `videoSrc` is supplied. Copy here is PROVISIONAL (concept
// framing, "coming next"), pending the founder's review of the previews.

type Reaction = 'would_use' | 'interested_concerns' | 'not_useful'

interface PhaseDef {
  phase: 2 | 3
  eyebrow: string
  title: string
  blurb: string
  /** When present, a real preview video renders instead of the placeholder. */
  videoSrc?: string
}

const PHASES: PhaseDef[] = [
  {
    phase: 2,
    eyebrow: 'Coming next · a concept, not a feature yet',
    title: 'Seeing your patterns',
    blurb: 'A look at how Soul Space could show the emotional patterns you carry, the themes that repeat, and how they shift over time.',
  },
  {
    phase: 3,
    eyebrow: 'Further ahead · a concept, not a feature yet',
    title: 'A companion that adapts',
    blurb: 'A glimpse of Soul Space as a more personal reflection companion — gentle, and always something you stay in control of.',
  },
]

const REACTIONS: { value: Reaction; label: string }[] = [
  { value: 'would_use', label: "I'd use this" },
  { value: 'interested_concerns', label: 'Interested, but I have concerns' },
  { value: 'not_useful', label: 'Not useful for me' },
]

function PhaseCard({ def }: { def: PhaseDef }) {
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(false)

  async function share() {
    if (!reaction || submitting) return
    setSubmitting(true)
    setError(false)
    try {
      const res = await fetch('/api/phase-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: def.phase,
          reaction,
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) { setError(true); return }
      setSubmitted(true)
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.06)' }}
    >
      <div className="text-[15px] tracking-[.12em] uppercase mb-2" style={{ color: 'rgba(201,168,76,.7)' }}>
        {def.eyebrow}
      </div>
      <h3 className="font-serif text-sand2 mb-1.5" style={{ fontSize: '20px' }}>{def.title}</h3>
      <p className="text-sm text-mist leading-relaxed mb-3">{def.blurb}</p>

      {/* Preview video slot — placeholder until an asset is supplied */}
      {def.videoSrc ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video className="w-full rounded-lg mb-3" controls preload="none" src={def.videoSrc} />
      ) : (
        <div
          className="w-full rounded-lg mb-3 flex items-center justify-center"
          style={{ aspectRatio: '16 / 9', background: 'rgba(6,14,24,.6)', border: '1px dashed rgba(245,237,216,.12)' }}
        >
          <span className="text-xs" style={{ color: 'rgba(245,237,216,.4)' }}>Preview video coming soon</span>
        </div>
      )}

      {submitted ? (
        <p className="text-sm" style={{ color: 'var(--teal2)' }}>Thank you — noted.</p>
      ) : (
        <>
          <div className="text-xs text-mist mb-2">Would this be useful to you?</div>
          <div className="flex gap-2 flex-wrap mb-3" role="radiogroup" aria-label={`Reaction to ${def.title}`}>
            {REACTIONS.map(r => {
              const active = reaction === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setReaction(r.value)}
                  className="px-3.5 py-2 text-xs rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    border: active ? '1px solid rgba(201,168,76,.4)' : '1px solid rgba(245,237,216,.08)',
                    background: active ? 'rgba(201,168,76,.1)' : 'transparent',
                    color: active ? 'var(--gold2)' : 'rgba(245,237,216,.76)',
                  }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>

          {reaction && (
            <div className="animate-fade-in">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="What excites you, concerns you, or would make this more useful? (optional)"
                className="w-full bg-transparent text-sm text-sand2 placeholder:text-mist/70 rounded-lg p-3 focus:outline-none"
                style={{ border: '1px solid rgba(245,237,216,.1)', resize: 'vertical' }}
              />
              <button
                type="button"
                onClick={share}
                disabled={submitting}
                className="btn-outline text-xs py-2 px-4 mt-2 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Share →'}
              </button>
              {error && (
                <p className="text-xs mt-1.5" style={{ color: 'rgba(213,226,235,.6)' }}>
                  Couldn&apos;t save — please try again.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Renders the Phase 2/3 previews. `visible` is controlled by the caller
 * (shown to beta-access users, and to everyone on non-production for review).
 */
export function PhasePreview({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="mt-8">
      <div className="text-[16px] tracking-[.13em] uppercase mb-1.5" style={{ color: 'var(--teal2)' }}>
        A look ahead
      </div>
      <p className="text-xs text-mist mb-4 leading-relaxed">
        Two quick previews of where Soul Space might go next. Nothing here is built yet — we
        just want to know what would actually be useful to you. Takes a minute.
      </p>
      {PHASES.map(p => <PhaseCard key={p.phase} def={p} />)}
    </div>
  )
}
