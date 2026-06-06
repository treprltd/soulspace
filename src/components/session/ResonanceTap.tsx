'use client'

import { ResonanceTap as TapResult } from '@/types'

interface ResonanceTapProps {
  onTap: (result: TapResult) => void
  selected?: TapResult
}

export function ResonanceTap({ onTap, selected }: ResonanceTapProps) {
  return (
    <div
      className="rounded-xl p-3.5 mb-3"
      style={{ background: 'rgba(15,30,46,.8)', border: '1px solid rgba(201,168,76,.14)' }}
    >
      <div className="text-xs tracking-[.12em] uppercase text-gold mb-3 flex items-center gap-1.5">
        Did this feel accurate?
      </div>

      <div className="flex gap-2">
        {/* Accurate */}
        <button
          onClick={() => onTap('accurate')}
          className="flex-1 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer"
          style={{
            border: selected === 'accurate'
              ? '1px solid rgba(42,140,122,.8)'
              : '1px solid rgba(42,140,122,.3)',
            background: selected === 'accurate'
              ? 'rgba(42,140,122,.22)'
              : 'rgba(42,140,122,.06)',
            color: selected === 'accurate' ? 'var(--teal2)' : 'rgba(61,175,150,.6)',
          }}
        >
          {selected === 'accurate' ? '✓ Felt accurate' : 'This felt accurate'}
        </button>

        {/* Not quite */}
        <button
          onClick={() => onTap('not_quite')}
          className="flex-1 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer"
          style={{
            border: selected === 'not_quite'
              ? '1px solid rgba(245,237,216,.55)'
              : '1px solid rgba(245,237,216,.1)',
            background: selected === 'not_quite'
              ? 'rgba(245,237,216,.1)'
              : 'transparent',
            color: selected === 'not_quite' ? 'var(--sand2)' : 'rgba(139,167,184,.55)',
          }}
        >
          {selected === 'not_quite' ? '✓ Not quite' : 'Not quite'}
        </button>
      </div>

      {/* Confirmation message after tap */}
      {selected && (
        <p className="text-xs mt-2.5 text-center leading-relaxed" style={{ color: 'rgba(139,167,184,.45)' }}>
          {selected === 'accurate'
            ? 'Noted. This helps Soul Space improve.'
            : 'Noted. That helps too — every response teaches the Mirror.'}
        </p>
      )}
    </div>
  )
}
