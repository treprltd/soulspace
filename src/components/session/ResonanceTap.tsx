'use client'

import { useState } from 'react'
import { ResonanceTap as TapResult } from '@/types'

interface ResonanceTapProps {
  onTap: (result: TapResult) => void
  selected?: TapResult
  /** Called with the user's answer to "What did it miss?" when they tap "Try again" */
  onCorrection?: (text: string) => void
  /** True while a regenerated reflection is being fetched */
  regenerating?: boolean
  /** True once a correction has already been used this session (one-shot) */
  correctionUsed?: boolean
}

export function ResonanceTap({ onTap, selected, onCorrection, regenerating, correctionUsed }: ResonanceTapProps) {
  const [correctionText, setCorrectionText] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const showCorrectionPrompt =
    selected === 'not_quite' && !correctionUsed && !dismissed && !regenerating && !!onCorrection

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
            color: selected === 'not_quite' ? 'var(--sand2)' : 'rgba(213,226,235,.72)',
          }}
        >
          {selected === 'not_quite' ? '✓ Not quite' : 'Not quite'}
        </button>
      </div>

      {/* Regenerating — calm holding line */}
      {regenerating && (
        <p className="font-serif text-sm mt-3 text-center leading-relaxed" style={{ color: 'rgba(213,226,235,.85)' }}>
          Taking another look, with what you just shared.
        </p>
      )}

      {/* "Not quite" follow-up — one gentle micro-question, one-shot */}
      {showCorrectionPrompt && (
        <div className="mt-3">
          <label className="text-xs tracking-[.08em] uppercase block mb-2" style={{ color: 'rgba(213,226,235,.7)' }}>
            What did it miss?
          </label>
          <input
            type="text"
            value={correctionText}
            onChange={e => setCorrectionText(e.target.value)}
            placeholder="A word or two is enough"
            maxLength={300}
            className="w-full rounded-lg px-3 py-2.5 text-sm mb-2.5"
            style={{
              background: 'rgba(8,17,28,.6)',
              border: '1px solid rgba(245,237,216,.14)',
              color: 'var(--sand2)',
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const text = correctionText.trim()
                if (text && onCorrection) onCorrection(text)
              }}
              disabled={!correctionText.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default"
              style={{
                border: '1px solid rgba(201,168,76,.4)',
                background: 'rgba(201,168,76,.1)',
                color: 'var(--gold)',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
              style={{
                border: '1px solid rgba(245,237,216,.1)',
                background: 'transparent',
                color: 'rgba(213,226,235,.72)',
              }}
            >
              Leave it as is
            </button>
          </div>
        </div>
      )}

      {/* Confirmation message after tap */}
      {selected && !regenerating && !showCorrectionPrompt && (
        <p className="text-xs mt-2.5 text-center leading-relaxed" style={{ color: 'rgba(213,226,235,.65)' }}>
          {selected === 'accurate'
            ? 'Noted. This helps Soul Space improve.'
            : 'Noted. That helps too — every response teaches the Mirror.'}
        </p>
      )}
    </div>
  )
}
