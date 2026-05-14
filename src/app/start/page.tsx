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
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg text-center animate-fade-in">
          {/* Pre-session affirmation — not one of the 5 session moments */}
          <div className="affirm-copy mb-6">
            Whatever brought you here —<br />you do not need to have it figured out yet.
          </div>

          <h1 className="font-serif font-light text-sand2 leading-tight mb-3" style={{ fontSize: '26px' }}>
            A quiet place to understand yourself<br />
            <em className="text-gold2">before you decide.</em>
          </h1>

          <p className="text-xs text-mist mb-8 leading-loose">
            Not therapy. Not meditation. Not a budgeting app.<br />
            The pause before the decision that changes things.
          </p>

          <div className="w-6 h-px mx-auto mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />

          <div
            className="text-left rounded-xl p-4 mb-6"
            style={{ background: 'rgba(15,30,46,.7)' }}
          >
            <div className="scope-row">
              <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--teal2)', width: '16px' }}>✓</span>
              <span className="text-[11px] leading-relaxed" style={{ color: 'var(--teal2)' }}>
                Recognise emotional patterns before important decisions
              </span>
            </div>
            <div className="scope-row">
              <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--teal2)', width: '16px' }}>✓</span>
              <span className="text-[11px] leading-relaxed" style={{ color: 'var(--teal2)' }}>
                Seasonal emotional language — clinically reviewed, non-diagnostic
              </span>
            </div>
            <div className="scope-row">
              <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(212,64,64,.6)', width: '16px' }}>✕</span>
              <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(212,64,64,.6)' }}>
                Not a crisis service — call 988 if you are in immediate danger
              </span>
            </div>
            <div className="scope-row">
              <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(212,64,64,.6)', width: '16px' }}>✕</span>
              <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(212,64,64,.6)' }}>
                Not diagnostic — no clinical conclusions, no treatment plans
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push('/session')}
            className="btn-primary w-full py-3.5 text-[13px] mb-3"
          >
            Begin →
          </button>

          {/* Auth-aware secondary action */}
          {isAuthenticated === true && (
            <Link
              href="/dashboard"
              className="text-[10px] block text-center transition-opacity hover:opacity-80"
              style={{ color: 'rgba(201,168,76,.5)' }}
            >
              ← Back to your dashboard
            </Link>
          )}
          {isAuthenticated === false && (
            <Link
              href="/auth/signin"
              className="text-[10px] block text-center transition-opacity hover:opacity-80"
              style={{ color: 'rgba(139,167,184,.4)' }}
            >
              Sign in to save sessions →
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
