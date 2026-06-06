'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'

export default function Welcome() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user)
    })
  }, [])

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#060E18' }}>
      <NavBar />
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center animate-fade-in">

          {/* Frozen affirmation copy */}
          <div className="affirm-copy mb-8">
            Whatever brought you here —<br />you do not need to have it figured out yet.
          </div>

          <h1
            className="font-serif font-light text-sand2 leading-tight mb-5"
            style={{ fontSize: '28px' }}
          >
            A quiet space to hear<br />
            <em className="text-gold2">what you&rsquo;re carrying.</em>
          </h1>

          <p className="text-xs text-mist mb-8 leading-relaxed">
            5–10 minutes &nbsp;·&nbsp; Private &nbsp;·&nbsp; No right answers
          </p>

          {/* ── How it works — 3-step visual flow ──────────────── */}
          <div className="flex items-center justify-center gap-0 mb-10 w-full">
            {[
              { step: '01', label: 'Share what\'s present', icon: '◇' },
              { step: '02', label: 'Mirror reflects it back', icon: '◎' },
              { step: '03', label: 'One thing to carry forward', icon: '→' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center" style={{ minWidth: 82 }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
                    style={{
                      background: 'rgba(201,168,76,.06)',
                      border: '1px solid rgba(201,168,76,.18)',
                    }}
                  >
                    <span style={{ color: 'var(--gold2)', fontSize: '14px' }}>{item.icon}</span>
                  </div>
                  <div className="text-[11px] tracking-[.08em] uppercase mb-1" style={{ color: 'rgba(201,168,76,.5)' }}>
                    {item.step}
                  </div>
                  <p className="text-xs leading-snug text-center" style={{ color: 'rgba(245,237,216,.45)' }}>
                    {item.label}
                  </p>
                </div>
                {i < 2 && (
                  <div
                    className="flex-shrink-0 mx-1 mb-6"
                    style={{ width: 16, height: 1, background: 'rgba(201,168,76,.18)' }}
                  />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/session/breathe')}
            className="btn-primary w-full py-4 text-sm mb-6"
          >
            Begin →
          </button>

          {isAuthenticated === true && (
            <Link
              href="/dashboard"
              className="text-xs block text-center transition-opacity hover:opacity-80"
              style={{ color: 'rgba(201,168,76,.5)' }}
            >
              ← Back to your dashboard
            </Link>
          )}
          {isAuthenticated === false && (
            <Link
              href="/auth/signin"
              className="text-xs block text-center transition-opacity hover:opacity-80"
              style={{ color: 'rgba(139,167,184,.45)' }}
            >
              Sign in to save your sessions →
            </Link>
          )}

          <p
            className="text-xs mt-10 leading-relaxed"
            style={{ color: 'rgba(139,167,184,.28)' }}
          >
            Not therapy &nbsp;·&nbsp; Not a diagnosis &nbsp;·&nbsp; Not a crisis service
          </p>

        </div>
      </div>
    </main>
  )
}
