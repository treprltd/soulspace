'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Branch, SituationId } from '@/types'
import { NavBar } from '@/components/ui/NavBar'

interface Situation {
  id: SituationId
  label: string
  symbol: string
  branch: Branch
}

// Each situation maps internally to one of the four resonance branches.
// A = decision_pressure  B = something_unnamed
// C = pattern_repeating  D = carrying_alone
const SITUATIONS: Situation[] = [
  { id: 'work-career',  label: 'Work or career',   symbol: '◈', branch: 'A' },
  { id: 'relationship', label: 'A relationship',    symbol: '◡', branch: 'D' },
  { id: 'family',       label: 'Family',            symbol: '△', branch: 'D' },
  { id: 'money',        label: 'Money',             symbol: '◎', branch: 'A' },
  { id: 'big-decision', label: 'A big decision',    symbol: '⊙', branch: 'A' },
  { id: 'my-health',    label: 'My health',         symbol: '○', branch: 'B' },
  { id: 'who-i-am',     label: 'Who I am',          symbol: '◇', branch: 'B' },
  { id: 'loss-grief',   label: 'Loss or grief',     symbol: '▽', branch: 'D' },
  { id: 'anxiety',      label: 'Anxiety',           symbol: '≈', branch: 'C' },
  { id: 'life-change',  label: 'A life change',     symbol: '→', branch: 'C' },
  { id: 'friendship',   label: 'Friendship',        symbol: '∞', branch: 'D' },
  { id: 'not-sure',     label: 'Not sure yet',      symbol: '···', branch: 'B' },
]

export default function SituationEntry() {
  const router = useRouter()
  const [selected, setSelected] = useState<SituationId | null>(null)

  const handleSelect = (s: Situation) => {
    setSelected(s.id)
    sessionStorage.setItem('ss_branch', s.branch)
    sessionStorage.setItem('ss_situation', s.id)
    // Brief pause so the selection is visible before navigating
    setTimeout(() => router.push('/session/emotions'), 280)
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: 'rgba(139,167,184,.45)', fontSize: '11px' }}>Your session</span>} />
      <div className="flex items-center justify-center px-4 sm:px-5 py-8 sm:py-10">
        <div className="w-full max-w-lg animate-fade-in">

          <div className="text-center mb-8">
            {/* AFFIRMATION MOMENT 1 — frozen copy */}
            <div className="affirm-copy mb-5">
              You do not need to explain everything right away.<br />
              Let&rsquo;s begin with what feels closest.
            </div>
            <h1
              className="font-serif font-light text-sand2 leading-tight mb-2"
              style={{ fontSize: '26px' }}
            >
              What is this <em className="text-gold2">mostly about?</em>
            </h1>
            <p className="text-sm text-mist">
              You may be carrying more than one thing. Choose what feels most present.
            </p>
          </div>

          {/* 3-column grid — 12 situations incl. escape hatch */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            {SITUATIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`situation-card${selected === s.id ? ' selected' : ''}`}
              >
                <span className="situation-symbol">{s.symbol}</span>
                <span className="situation-label">{s.label}</span>
              </button>
            ))}
          </div>

          <p
            className="text-center leading-relaxed text-xs"
            style={{ color: 'rgba(139,167,184,.38)' }}
          >
            No wrong answer. Everything that follows adapts to what you choose.
          </p>

        </div>
      </div>
    </main>
  )
}
