'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/session/ProgressBar'
import { createClient } from '@/lib/supabase/client'

const MAX_CHARS = 800

export default function ContextField() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    sessionStorage.setItem('ss_context', text)

    // ── Create a session row in Supabase for authenticated users ─────────────
    // This is the earliest point at which we have all info needed to create a
    // session (branch is already in sessionStorage from the resonance screen).
    // The session ID is stored in sessionStorage so the loading page can pass
    // it to the mirror API, which then links session_content to this row.
    //
    // Unauthenticated users skip this — they still get the mirror output, it
    // just won't be persisted.
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.access_token) {
        const branch = sessionStorage.getItem('ss_branch') ?? 'A'
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ branch }),
        })

        if (res.ok) {
          const { session: dbSession } = await res.json() as { session: { id: string } }
          // Store the real DB session ID so the mirror API can link to this row
          sessionStorage.setItem('ss_session_id', dbSession.id)
        }
        // If session creation fails (e.g. network error), we clear any stale ID
        // so the loading page uses a random UUID — mirror still works, no persistence
        else {
          sessionStorage.removeItem('ss_session_id')
        }
      } else {
        // Not authenticated — clear any leftover session ID from a previous run
        sessionStorage.removeItem('ss_session_id')
      }
    } catch {
      // Non-blocking — unauthenticated / offline users still get the mirror
      sessionStorage.removeItem('ss_session_id')
    }

    router.push('/session/loading')
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
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
            className="w-full rounded-xl p-3 text-xs text-mist leading-relaxed resize-none focus:outline-none focus:border-gold/30 transition-colors italic"
            style={{
              background: 'rgba(245,237,216,.03)',
              border: '1px solid rgba(245,237,216,.07)',
              color: 'var(--mist)',
              fontFamily: 'inherit',
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
