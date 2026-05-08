'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Branch } from '@/types'
import { NavBar } from '@/components/ui/NavBar'

const RESONANCE_PHRASES: { id: Branch; text: string }[] = [
  { id: 'A', text: "Something keeps pulling you back to a decision you thought you'd made." },
  { id: 'B', text: "You know what you feel but can't quite explain why." },
  { id: 'C', text: "You're not in crisis. But something isn't right." },
  { id: 'D', text: "You've been carrying this alone for a while." },
]

export default function ResonanceEntry() {
  const router = useRouter()
  const [selected, setSelected] = useState<Branch | null>(null)

  const handleSelect = (branch: Branch) => {
    setSelected(branch)
    // Store branch in sessionStorage for the session flow
    sessionStorage.setItem('ss_branch', branch)
    // Brief pause so the selection is visible before navigating
    setTimeout(() => router.push('/session/emotions'), 280)
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="text-center mb-8">
            {/* AFFIRMATION MOMENT 1 — frozen copy */}
            <div className="affirm-copy mb-5">
              You do not need to explain everything right away.<br />
              Let&rsquo;s begin with what feels closest.
            </div>
            <h1 className="font-serif font-light text-sand2 leading-tight mb-2" style={{ fontSize: '26px' }}>
              Right now, something feels<br />
              <em className="text-gold2">like this —</em>
            </h1>
            <p className="text-[11px] text-mist">
              You may be carrying more than one thing. Tap the one that fits most.
            </p>
          </div>

          <div>
            {RESONANCE_PHRASES.map(({ id, text }) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className={`resonance-phrase w-full text-left pr-10 ${selected === id ? 'selected' : ''}`}
              >
                &ldquo;{text}&rdquo;
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 font-sans not-italic text-[11px]"
                  style={{ color: 'rgba(201,168,76,.3)' }}
                >
                  →
                </span>
              </button>
            ))}
          </div>

          <p className="text-center text-[9px] mt-4 leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
            No need to get it perfect. No wrong answer.<br />
            Everything that follows adapts to your selection.
          </p>
        </div>
      </div>
    </main>
  )
}
