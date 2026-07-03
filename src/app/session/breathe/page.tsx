'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Grounding pause — Calm's signature opening move.
// Auto-advances after 4 s; tapping anywhere continues immediately.
export default function Breathe() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.push('/session'), 4000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 cursor-pointer"
      style={{ background: '#060E18' }}
      onClick={() => router.push('/session')}
    >
      {/* Breathing circle */}
      <div className="breathe-ring mb-12">
        <div className="breathe-core" />
      </div>

      <h2
        className="font-serif font-light text-sand2 mb-4 animate-fade-in"
        style={{ fontSize: '30px', letterSpacing: '.01em' }}
      >
        Take a moment.
      </h2>

      <p
        className="animate-fade-in"
        style={{
          fontSize: '19px',
          color: 'rgba(213,226,235,.72)',
          letterSpacing: '.05em',
        }}
      >
        Whenever you&rsquo;re ready —
      </p>
    </main>
  )
}
