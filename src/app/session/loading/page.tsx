'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Branch, MirrorOutput } from '@/types'

export default function MirrorLoading() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const branch = (sessionStorage.getItem('ss_branch') ?? 'A') as Branch
    const emotions = JSON.parse(sessionStorage.getItem('ss_emotions') ?? '[]') as string[]
    const intensity = Number(sessionStorage.getItem('ss_intensity') ?? '5')
    const context = sessionStorage.getItem('ss_context') ?? ''

    async function callMirror() {
      try {
        const res = await fetch('/api/mirror', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionStorage.getItem('ss_session_id') ?? crypto.randomUUID(),
            branch,
            emotionTags: emotions,
            intensity,
            contextText: context,
          }),
        })

        const data = await res.json() as { crisis?: boolean; mirror?: MirrorOutput; error?: unknown; detail?: string }

        if (data.crisis) {
          router.push('/crisis')
          return
        }

        if (data.mirror) {
          sessionStorage.setItem('ss_mirror', JSON.stringify(data.mirror))
          router.push('/session/reflection')
          return
        }

        setError('Something went wrong. Please try again.')
      } catch {
        setError('Connection error. Please check your internet and try again.')
      }
    }

    callMirror()
  }, [router])

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center" style={{ background: '#060E18' }}>
        <p className="text-sm text-mist mb-4">{error}</p>
        <button onClick={() => router.back()} className="btn-outline text-xs">Go back</button>
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
          Finding the <em className="text-gold2">shape</em><br />of what you shared.
        </h2>
        {/* AFFIRMATION MOMENT 3 — frozen copy */}
        <p className="font-serif italic leading-loose" style={{ fontSize: '13px', color: 'rgba(139,167,184,.5)' }}>
          Not judging. Just trying to find<br />what sits underneath it.
        </p>
      </div>
    </main>
  )
}
