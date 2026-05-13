'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/session/ProgressBar'

const MAX_CHARS = 800

export default function ContextField() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    sessionStorage.setItem('ss_context', text)
    router.push('/session/loading')
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <NavBar right="Step 3 of 3" />
      <div className="px-6 py-5 max-w-xl mx-auto animate-fade-in">
        <ProgressBar step={3} total={3} />

        <h2 className="font-serif font-light text-sand2 text-2xl mb-2 leading-tight">
          What&apos;s <em className="text-gold2">happening?</em>
        </h2>
        <p className="text-xs text-mist mb-3">
          In your own words. As much or as little as feels right.
        </p>

        <div className="relative mb-1.5">
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Start wherever feels natural..."
            rows={5}
            className="w-full resize-none focus:outline-none transition-colors"
            style={{
              padding: '14px 16px',
              fontSize: '15px',
              lineHeight: 1.55,
              fontStyle: 'italic',
              fontFamily: 'var(--font-sans)',
              color: 'var(--sand)',
              borderRadius: 'var(--r-lg)',
              background: 'rgba(245,237,216,.03)',
              border: '1px solid rgba(245,237,216,.18)',
              boxSizing: 'border-box',
              width: '100%',
            }}
          />
        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="text-[8px] italic" style={{ color: 'rgba(139,167,184,.35)' }}>
            Just start — no minimum
          </span>
          <span className="text-[8px]" style={{ color: 'rgba(139,167,184,.35)' }}>
            {text.length} / {MAX_CHARS}
          </span>
        </div>

        <div className="flex gap-2.5">
          <button onClick={() => router.back()} className="btn-outline text-xs">Back</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Finding the shape…' : 'See your reflection →'}
          </button>
        </div>

        <p className="text-[9px] mt-3 leading-relaxed" style={{ color: 'rgba(139,167,184,.3)' }}>
          Note: Voice input is approved clinically but not built in Phase 1.
        </p>
      </div>
    </main>
  )
}
