'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/session/ProgressBar'

const EMOTION_TAGS = [
  'Overwhelmed', 'Stuck', 'Uncertain', 'Pressured', 'Anxious', 'Conflicted',
  'Exhausted', 'Resigned', 'Afraid', 'Numb', 'Relieved', 'Hopeful',
  'Frustrated', 'Lonely', 'Grief',
]

export default function Emotions() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (tag: string) => {
    setSelected(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleContinue = () => {
    if (selected.length === 0) return
    sessionStorage.setItem('ss_emotions', JSON.stringify(selected))
    router.push('/session/intensity')
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <NavBar right="Step 1 of 3" />
      <div className="px-6 py-5 max-w-xl mx-auto animate-fade-in">
        <ProgressBar step={1} total={3} />

        {/* AFFIRMATION MOMENT 2 — frozen copy */}
        <div className="affirm-copy mb-3.5">
          Something here already has a shape.<br />
          You do not have to name all of it.
        </div>

        <h2 className="font-serif font-light text-sand2 text-3xl mb-1.5 leading-tight">
          What are you carrying <em className="text-gold2">right now?</em>
        </h2>
        <p className="text-base text-mist mb-4">
          Choose what feels most present. More than one can be true.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {EMOTION_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={`emotion-tag ${selected.includes(tag) ? 'selected' : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <p className="text-[13px] mb-5" style={{ color: 'rgba(139,167,184,.72)' }}>
            {selected.length} selected
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </main>
  )
}
