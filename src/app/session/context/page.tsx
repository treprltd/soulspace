'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/session/ProgressBar'
import { VoiceInput } from '@/components/session/VoiceInput'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/analytics'

const MAX_CHARS = 800

// Attempts to create the sessions row — used as a fallback retry here when
// the primary creation at the situation-picker screen didn't leave a
// ss_session_id behind (failed silently, or this page was reached directly).
async function tryCreateSession(): Promise<string | undefined> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return undefined

    const branch    = sessionStorage.getItem('ss_branch')    ?? 'A'
    const situation = sessionStorage.getItem('ss_situation') ?? undefined
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ branch, ...(situation ? { situation } : {}) }),
    })
    if (!res.ok) return undefined
    const { session: dbSession } = await res.json() as { session: { id: string } }
    return dbSession.id
  } catch {
    return undefined
  }
}

export default function ContextField() {
  const router = useRouter()
  const [text, setText]                   = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isPaid, setIsPaid]               = useState(false)
  const [sessionSaveFailed, setSessionSaveFailed] = useState(false)
  const [retrying, setRetrying]           = useState(false)

  // ── Check auth + subscription status on mount ────────────────────────────
  useEffect(() => {
    const checkStatus = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      setIsAuthenticated(true)

      try {
        const res = await fetch('/api/subscription', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json() as { planTier: string }
          setIsPaid(data.planTier !== 'free')
        }
      } catch {
        // Subscription check failed — voice input stays locked, session continues normally
      }

      // Session row is normally created already at the situation-picker
      // screen. If it's missing here for an authenticated user, that attempt
      // failed silently — retry once now and surface a banner (not blocking)
      // if it fails again, instead of quietly proceeding with no record at all.
      if (!sessionStorage.getItem('ss_session_id')) {
        const id = await tryCreateSession()
        if (id) {
          sessionStorage.setItem('ss_session_id', id)
        } else {
          setSessionSaveFailed(true)
        }
      }
    }
    checkStatus()
  }, [])

  const handleRetrySave = async () => {
    setRetrying(true)
    const id = await tryCreateSession()
    if (id) {
      sessionStorage.setItem('ss_session_id', id)
      setSessionSaveFailed(false)
    }
    setRetrying(false)
  }

  // ── Transcript handler — appends to existing text ────────────────────────
  const handleTranscript = (transcript: string) => {
    setText(prev => {
      const joined = prev.trim() ? `${prev.trim()} ${transcript}` : transcript
      return joined.slice(0, MAX_CHARS)
    })
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    sessionStorage.setItem('ss_context', text)

    // The session row (if any — authenticated users only) was already
    // created at the situation-picker screen, with a retry attempted above
    // on mount if that failed. Use whatever ended up in sessionStorage rather
    // than creating another row here, which would otherwise leave a duplicate
    // orphaned session behind every time this page is reached.
    logEvent({
      sessionId: sessionStorage.getItem('ss_session_id') ?? undefined,
      eventName: 'context_submitted',
      properties: { char_count: text.length },
    })

    router.push('/session/loading')
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div className="session-outer-pad px-6 py-5 max-w-xl mx-auto animate-fade-in">
        <ProgressBar step={3} total={3} />

        <h2 className="font-serif font-light text-sand2 text-2xl mb-2 leading-tight">
          What&apos;s <em className="text-gold2">happening?</em>
        </h2>
        <p className="text-sm text-mist mb-5 leading-relaxed">
          In your own words. As much or as little as feels right.
        </p>

        {/* Textarea + voice button ─────────────────────────────────────── */}
        <div className="relative mb-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Start wherever feels natural..."
            rows={7}
            className="w-full rounded-2xl p-4 text-sm leading-relaxed resize-none focus:outline-none transition-colors"
            style={{
              background:  'rgba(245,237,216,.03)',
              border:      '1px solid rgba(245,237,216,.08)',
              color:       'var(--sand2)',
              fontFamily:  'var(--font-cormorant), Georgia, serif',
              fontStyle:   'italic',
              fontSize:    '16px',
              lineHeight:  '1.75',
              paddingBottom: '3rem', // room for the mic button
            }}
            onFocus={e  => { e.target.style.borderColor = 'rgba(201,168,76,.25)' }}
            onBlur={e   => { e.target.style.borderColor = 'rgba(245,237,216,.08)' }}
          />

          {/* Voice input — bottom-right of textarea */}
          <div className="absolute bottom-3 right-3">
            <VoiceInput
              onTranscript={handleTranscript}
              isAuthenticated={isAuthenticated}
              isPaid={isPaid}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Char count row */}
        <div className="flex items-center justify-between mb-6" style={{ minHeight: '16px' }}>
          <span
            className="text-xs leading-none"
            style={{ color: 'rgba(213,226,235,.60)', visibility: (!isAuthenticated || !isPaid) ? 'visible' : 'hidden' }}
          >
            {!isAuthenticated
              ? 'Voice input available for subscribers'
              : !isPaid
              ? 'Voice input available on paid plans'
              : null}
          </span>
          {text.length > 0 && (
            <span className="text-xs" style={{ color: 'rgba(213,226,235,.60)' }}>
              {text.length} / {MAX_CHARS}
            </span>
          )}
        </div>

        <p className="text-xs text-center mb-4 leading-relaxed" style={{ color: 'rgba(213,226,235,.55)' }}>
          ◈ What you share is encrypted at rest and never used to train AI.{' '}
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            Privacy policy →
          </a>
        </p>

        {/* Session-save failure — non-blocking. The reflection still works
            either way; this only affects whether it's saved to the account. */}
        {sessionSaveFailed && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 mb-4"
            style={{ background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.15)' }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.7)' }}>
              This session may not save to your account right now.
            </p>
            <button
              onClick={handleRetrySave}
              disabled={retrying}
              className="text-xs flex-shrink-0 underline underline-offset-2 disabled:opacity-50"
              style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-outline text-xs px-5">
            ← Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 py-3.5 disabled:opacity-50"
          >
            {submitting ? 'Finding the shape…' : 'See your reflection →'}
          </button>
        </div>
      </div>
    </main>
  )
}
