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

          <p className="text-xs text-mist mb-12 leading-relaxed">
            5–10 minutes &nbsp;·&nbsp; Private &nbsp;·&nbsp; No right answers
          </p>

          <button
            onClick={() => router.push('/session/breathe')}
            className="btn-primary w-full py-4 text-[13px] mb-6"
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
            className="text-[9px] mt-10 leading-relaxed"
            style={{ color: 'rgba(139,167,184,.28)' }}
          >
            Not therapy &nbsp;·&nbsp; Not a diagnosis &nbsp;·&nbsp; Not a crisis service
          </p>

        </div>
      </div>
    </main>
  )
}
