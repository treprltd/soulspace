'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Branch, MirrorOutput } from '@/types'
import { createClient } from '@/lib/supabase/client'

type ErrorKind = 'overloaded' | 'connection' | 'internal'

interface ErrorState {
  kind: ErrorKind
  retryCount: number
}

export default function MirrorLoading() {
  const router = useRouter()
  const [errorState, setErrorState] = useState<ErrorState | null>(null)
  const [retrying, setRetrying] = useState(false)
  const calledRef = useRef(false)

  const callMirror = useCallback(async () => {
    setRetrying(true)
    setErrorState(null)
    try {
      const branch = (sessionStorage.getItem('ss_branch') ?? 'A') as Branch
      const situation = sessionStorage.getItem('ss_situation') ?? undefined
      const emotions = JSON.parse(sessionStorage.getItem('ss_emotions') ?? '[]') as string[]
      const intensity = Number(sessionStorage.getItem('ss_intensity') ?? '5')
      const context = sessionStorage.getItem('ss_context') ?? ''

      // Build auth headers — Bearer token required for implicit-flow JWT auth
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`
      }

      const res = await fetch('/api/mirror', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: sessionStorage.getItem('ss_session_id') ?? crypto.randomUUID(),
          branch,
          emotionTags: emotions,
          intensity,
          contextText: context,
          ...(situation ? { situation } : {}),
        }),
      })

      const data = await res.json() as {
        crisis?: boolean
        mirror?: MirrorOutput
        paywall?: boolean
        code?: string
        error?: unknown
      }

      if (data.crisis) { router.push('/crisis'); return }
      if (data.paywall) { router.push('/pricing'); return }
      if (data.mirror) {
        sessionStorage.setItem('ss_mirror', JSON.stringify(data.mirror))
        router.push('/session/reflection')
        return
      }

      // Structured error codes — never show raw API messages to the user
      if (data.code === 'overloaded' || res.status === 503) {
        setErrorState(prev => ({ kind: 'overloaded', retryCount: (prev?.retryCount ?? 0) + 1 }))
      } else {
        setErrorState(prev => ({ kind: 'internal', retryCount: (prev?.retryCount ?? 0) + 1 }))
      }
    } catch {
      setErrorState(prev => ({ kind: 'connection', retryCount: (prev?.retryCount ?? 0) + 1 }))
    } finally {
      setRetrying(false)
    }
  }, [router])

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true
    callMirror()
  }, [callMirror])

  if (errorState && !retrying) {
    const isOverloaded = errorState.kind === 'overloaded'
    const isConnection = errorState.kind === 'connection'

    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: '#060E18' }}
      >
        <div style={{ maxWidth: '340px', width: '100%' }}>
          {/* Subtle icon */}
          <div
            className="mx-auto mb-6"
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              border: '1px solid rgba(201,168,76,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(201,168,76,.5)', fontSize: '18px',
            }}
          >
            {isOverloaded ? '◎' : '◇'}
          </div>

          <h2
            className="font-serif font-light mb-3 leading-snug"
            style={{ fontSize: '18px', color: 'var(--sand2)' }}
          >
            {isOverloaded
              ? 'One moment — we\'re busy right now.'
              : isConnection
              ? 'Connection interrupted.'
              : 'Something didn\'t work.'}
          </h2>

          <p
            className="mb-7 leading-relaxed"
            style={{ fontSize: '15px', color: 'var(--mist)' }}
          >
            {isOverloaded
              ? 'The reflection service is momentarily at capacity. Your session is intact — try again in a few seconds.'
              : isConnection
              ? 'Please check your connection and try again. Your context has been kept.'
              : 'Something unexpected happened on our end. Your session is intact — try again or go back.'}
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={callMirror}
              className="btn-primary text-sm"
              style={{ padding: '10px 22px' }}
            >
              Try again
            </button>
            <button
              onClick={() => router.back()}
              className="btn-outline text-sm"
              style={{ padding: '10px 18px' }}
            >
              Go back
            </button>
          </div>

          {errorState.retryCount > 1 && (
            <p
              className="mt-5"
              style={{ fontSize: '13px', color: 'rgba(213,226,235,.65)' }}
            >
              Still not working? Try refreshing the page.
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: '#060E18' }}
    >
      {/* Spinner */}
      <div
        className="w-12 h-12 rounded-full animate-spin-slow"
        style={{
          border: '2px solid rgba(201,168,76,.08)',
          borderTopColor: 'var(--gold)',
          opacity: 0.9,
        }}
      />

      <div className="animate-fade-in">
        <h2 className="font-serif font-light text-sand2 text-xl mb-3.5 leading-tight">
          {retrying
            ? <>Trying again…</>
            : <>Finding the <em className="text-gold2">shape</em><br />of what you shared.</>}
        </h2>
        {/* AFFIRMATION MOMENT 3 — frozen copy */}
        {!retrying && (
          <p className="font-serif italic leading-loose" style={{ fontSize: '15px', color: 'rgba(213,226,235,.72)' }}>
            Not judging. Just trying to find<br />what sits underneath it.
          </p>
        )}
      </div>
    </main>
  )
}
