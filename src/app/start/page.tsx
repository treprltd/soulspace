'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'

// Three simple steps — factual but warm, not clinical or procedural
const STEPS = [
  {
    n: '1',
    heading: 'Tap what feels closest',
    body: "You'll see four phrases. Tap the one that fits most right now. There's no wrong answer.",
  },
  {
    n: '2',
    heading: "Say what's happening — briefly",
    body: "A few emotions, a couple of sentences. You don't need to explain everything.",
  },
  {
    n: '3',
    heading: 'The Mirror reflects it back',
    body: 'Not a diagnosis. Not advice. A quiet read of what seems to be present, from what you shared.',
  },
]

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
        <div className="w-full max-w-md text-center animate-fade-in">

          {/* Frozen affirmation copy */}
          <div className="affirm-copy mb-6">
            Whatever brought you here —<br />you do not need to have it figured out yet.
          </div>

          {/* Heading */}
          <h1 className="font-serif font-light text-sand2 leading-tight mb-2" style={{ fontSize: '26px' }}>
            A short guided reflection.<br />
            <em className="text-gold2">Private. No right answers.</em>
          </h1>

          <p className="text-sm text-mist mb-9 leading-relaxed">
            5–10 minutes. Nothing is stored without your permission.
          </p>

          {/* 3 steps — calm, sequential, specific */}
          <div className="space-y-4 mb-9 text-left">
            {STEPS.map(step => (
              <div key={step.n} className="flex items-start gap-4">
                <span
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium"
                  style={{
                    background: 'rgba(201,168,76,.08)',
                    border: '1px solid rgba(201,168,76,.22)',
                    color: 'var(--gold)',
                  }}
                >
                  {step.n}
                </span>
                <div className="pt-0.5">
                  <div className="text-sm font-medium text-sand mb-0.5">{step.heading}</div>
                  <div className="text-xs text-mist leading-relaxed">{step.body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-8 h-px mx-auto mb-7" style={{ background: 'rgba(201,168,76,.15)' }} />

          {/* Non-clinical note — soft, not a disclaimer box */}
          <p className="text-xs mb-8 leading-relaxed" style={{ color: 'rgba(139,167,184,.6)' }}>
            Not therapy · Not a diagnosis · Not a crisis service<br />
            <span style={{ color: 'rgba(139,167,184,.4)' }}>
              If you are in immediate danger, call or text 988.
            </span>
          </p>

          {/* Primary CTA */}
          <button
            onClick={() => router.push('/session')}
            className="btn-primary w-full py-3.5 text-[13px] mb-4"
          >
            Begin →
          </button>

          {/* Auth-aware secondary */}
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
              Sign in to save sessions →
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
