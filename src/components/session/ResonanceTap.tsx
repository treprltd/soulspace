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
      <div
        className="text-[8px] tracking-[.12em] uppercase text-gold mb-2.5 flex items-center gap-1"
        style={{ position: 'relative' }}
      >
        Did this feel accurate?
        <span
          className="text-[7px] text-gold2 ml-1 px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)' }}
        >
          KEY METRIC
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onTap('accurate')}
          className="flex-1 py-2.5 rounded-lg text-[11px] transition-all cursor-pointer"
          style={{
            border: selected === 'accurate'
              ? '1px solid rgba(42,140,122,.7)'
              : '1px solid rgba(42,140,122,.35)',
            background: selected === 'accurate'
              ? 'rgba(42,140,122,.18)'
              : 'rgba(42,140,122,.08)',
            color: 'var(--teal2)',
          }}
        >
          This felt accurate
        </button>
        <button
          onClick={() => onTap('not_quite')}
          className="flex-1 py-2.5 rounded-lg text-[11px] transition-all cursor-pointer"
          style={{
            border: selected === 'not_quite'
              ? '1px solid rgba(245,237,216,.25)'
              : '1px solid rgba(245,237,216,.08)',
            background: selected === 'not_quite' ? 'rgba(245,237,216,.05)' : 'transparent',
            color: 'var(--mist)',
          }}
        >
          Not quite
        </button>
      </div>
      <p className="text-[9px] mt-2 leading-relaxed" style={{ color: 'rgba(139,167,184,.4)' }}>
        One tap. No text required. The most important data point in Phase 1.
      </p>
    </div>
  )
}
