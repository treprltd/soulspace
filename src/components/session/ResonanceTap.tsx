'use client'

import { ResonanceTap as TapResult } from '@/types'

interface ResonanceTapProps {
  onTap: (result: TapResult) => void
  selected?: TapResult
}

export function ResonanceTap({ onTap, selected }: ResonanceTapProps) {
  return (
    <div
      style={{
        background: 'rgba(15,30,46,.8)',
        border: '1px solid rgba(201,168,76,.18)',
        borderRadius: 'var(--r-lg)',
        padding: '18px',
        marginBottom: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        Did this feel accurate?
        <span
          style={{
            fontSize: '9px',
            letterSpacing: '0.10em',
            padding: '3px 8px',
            borderRadius: '4px',
            background: 'rgba(201,168,76,.14)',
            border: '1px solid rgba(201,168,76,.40)',
            color: 'var(--gold2)',
          }}
        >
          KEY METRIC
        </span>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => onTap('accurate')}
          style={{
            flex: 1,
            padding: '14px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all .15s',
            color: '#5FD4BA',
            border: selected === 'accurate'
              ? '1px solid rgba(42,140,122,.85)'
              : '1px solid rgba(42,140,122,.45)',
            background: selected === 'accurate'
              ? 'rgba(42,140,122,.22)'
              : 'rgba(42,140,122,.10)',
          }}
        >
          This felt accurate
        </button>
        <button
          onClick={() => onTap('not_quite')}
          style={{
            flex: 1,
            padding: '14px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all .15s',
            color: selected === 'not_quite'
              ? 'rgba(190,210,225,.9)'
              : 'rgba(190,210,225,.7)',
            border: selected === 'not_quite'
              ? '1px solid rgba(139,167,184,.5)'
              : '1px dashed rgba(139,167,184,.35)',
            background: selected === 'not_quite'
              ? 'rgba(139,167,184,.06)'
              : 'transparent',
          }}
        >
          Not quite
        </button>
      </div>

      {/* Note */}
      <p
        style={{
          fontSize: '12px',
          color: 'var(--mist)',
          marginTop: '14px',
          lineHeight: 1.55,
        }}
      >
        One tap. No text required. The most important data point in Phase 1.
      </p>
    </div>
  )
}
