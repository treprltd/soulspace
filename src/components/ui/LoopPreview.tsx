'use client'

// LoopPreview — a short, looping animation of the core Affirm → Ask → Reflect
// flow for the landing page. Beta research (Theme 8) named comprehension as a
// barrier before first use: "It is very hard to describe what it is... until I
// experienced it I did not really understand what this meant" (Rosemary), and
// recommended extending the existing three-step preview into "a short
// animation of the full flow" / "problem to reflection to season to action"
// (Dan). This is a dependency-free CSS/SVG cycle that can later be swapped
// for produced video without touching the surrounding page.

import { useEffect, useState } from 'react'

const STEPS = [
  {
    key: 'affirm',
    label: 'Affirm',
    color: 'var(--teal2)',
    glow: 'rgba(42,140,122,.18)',
    copy: 'You arrive as you are. Nothing to explain yet.',
  },
  {
    key: 'ask',
    label: 'Ask',
    color: 'var(--gold)',
    glow: 'rgba(201,168,76,.18)',
    copy: 'A few gentle questions shape what you’re carrying.',
  },
  {
    key: 'reflect',
    label: 'Reflect',
    color: '#8AAAC8',
    glow: 'rgba(107,140,174,.18)',
    copy: 'The Mirror gives something back — specific, not generic.',
  },
] as const

const STEP_DURATION_MS = 3200

export function LoopPreview() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActive(i => (i + 1) % STEPS.length)
    }, STEP_DURATION_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div data-testid="loop-preview" className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-center gap-3 sm:gap-5 mb-4">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-3 sm:gap-5">
            <div className="flex flex-col items-center gap-1.5">
              <div
                data-testid={`loop-step-${step.key}`}
                data-active={active === i}
                className={`relative flex items-center justify-center rounded-full transition-all duration-500 ${active === i ? 'loop-step-active' : ''}`}
                style={{
                  width: active === i ? 44 : 34,
                  height: active === i ? 44 : 34,
                  background: `radial-gradient(circle, ${step.glow}, transparent 75%)`,
                  border: `1px solid ${active === i ? step.color : 'rgba(245,237,216,.1)'}`,
                }}
              >
                <span
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: active === i ? 14 : 9,
                    height: active === i ? 14 : 9,
                    background: active === i ? step.color : 'rgba(245,237,216,.2)',
                  }}
                />
              </div>
              <span
                className="text-xs uppercase tracking-[.12em] transition-colors duration-300"
                style={{ color: active === i ? step.color : 'rgba(139,167,184,.4)' }}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="block h-px w-6 sm:w-10 transition-colors duration-500"
                style={{ background: active > i ? step.color : 'rgba(245,237,216,.08)' }}
              />
            )}
          </div>
        ))}
      </div>

      <p
        data-testid="loop-preview-copy"
        className="text-center font-serif italic leading-relaxed transition-opacity duration-500"
        style={{ fontSize: '14px', color: 'rgba(232,201,122,.82)', minHeight: '2.6em' }}
      >
        {STEPS[active].copy}
      </p>
    </div>
  )
}
