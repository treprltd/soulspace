'use client'

// HowItWorks — a static, illustrated walkthrough of the Affirm → Ask → Reflect
// loop for the homepage. Complements LoopPreview (the small looping animation
// in the hero) with a slower, more legible explanation: one illustration, one
// short caption, per step — for visitors who want to actually understand the
// shape of a session before they commit to starting one. Beta research named
// comprehension as the barrier before first use ("It is very hard to describe
// what it is... until I experienced it I did not really understand what this
// meant" — Rosemary).
//
// Pure SVG, no images to host, matches the existing ink/gold/teal palette.
// Copy here is descriptive scaffolding around the product loop — NOT part of
// the frozen affirmation set in CLAUDE.md (those five strings are rendered
// verbatim elsewhere, inside the actual flow).

const STEPS = [
  {
    key: 'affirm',
    label: 'Affirm',
    color: 'var(--teal2)',
    glow: 'rgba(61,175,150,.16)',
    title: 'You arrive as you are',
    body: 'No forms to fill out, no history to explain. Whatever brought you here today is enough of a starting point.',
    Icon: AffirmIcon,
  },
  {
    key: 'ask',
    label: 'Ask',
    color: 'var(--gold)',
    glow: 'rgba(201,168,76,.16)',
    title: 'A few gentle questions',
    body: 'You point to what feels closest, name the shape of it, and say how strong it feels right now. Nothing to get "right."',
    Icon: AskIcon,
  },
  {
    key: 'reflect',
    label: 'Reflect',
    color: '#8AAAC8',
    glow: 'rgba(138,170,200,.16)',
    title: 'Something real comes back',
    body: 'The Mirror reflects the tension it hears in your words — specific to what you shared — and leaves you with one question, not an answer.',
    Icon: ReflectIcon,
  },
] as const

export function HowItWorks() {
  return (
    <div data-testid="how-it-works" className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
        {STEPS.map((step, i) => (
          <div key={step.key} className="relative flex flex-col items-center text-center px-2">
            {/* Connecting line to the next step (desktop only) */}
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="hidden sm:block absolute top-9 left-[calc(50%+44px)] right-[calc(-50%+44px)] h-px"
                style={{ background: 'rgba(245,237,216,.08)' }}
              />
            )}

            <div
              className="relative flex items-center justify-center rounded-full mb-4"
              style={{
                width: 72,
                height: 72,
                background: `radial-gradient(circle, ${step.glow}, transparent 72%)`,
                border: `1px solid ${step.color}`,
              }}
            >
              <step.Icon color={step.color} />
            </div>

            <span
              className="text-[18px] uppercase tracking-[.16em] mb-2"
              style={{ color: step.color }}
            >
              {String(i + 1).padStart(2, '0')} · {step.label}
            </span>

            <h3 className="font-serif font-light text-lg mb-2" style={{ color: 'var(--sand2)' }}>
              {step.title}
            </h3>

            <p className="text-sm leading-relaxed max-w-[26ch]" style={{ color: 'rgba(213, 226, 235, 0.78)' }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Icons — minimal single-stroke SVGs, ~24px viewport, colored via prop ──

function AffirmIcon({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* An open, receiving form — soft circle held within a circle */}
      <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.3" opacity="0.85" />
      <circle cx="12" cy="12" r="3.4" fill={color} opacity="0.9" />
    </svg>
  )
}

function AskIcon({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* A gentle question mark, rendered as a soft curve + point — not a clinical glyph */}
      <path
        d="M8.5 9.5a3.6 3.6 0 1 1 5.2 3.2c-1.1.6-1.7 1.2-1.7 2.3v.6"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <circle cx="12" cy="18.4" r="1.05" fill={color} opacity="0.9" />
    </svg>
  )
}

function ReflectIcon({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Two facing arcs — something offered, something reflected back */}
      <path d="M5 12a7 7 0 0 1 7-6" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M19 12a7 7 0 0 1-7 6" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M9.5 6.5 12 6l-.4 2.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
      <path d="M14.5 17.5 12 18l.4-2.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    </svg>
  )
}
