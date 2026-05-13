'use client'

// Client-side auth callback — handles PKCE code exchange in the browser
// so the code_verifier cookie is always accessible (same origin, no third-party
// cookie restrictions from the Supabase redirect chain).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function handleCallback() {
      // Read code and next from the URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const next = params.get('next') ?? '/start'
      const errorParam = params.get('error')
      const errorDescription = params.get('error_description')

      // Surface any error Supabase passed back in the URL
      if (errorParam) {
        const msg = errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          : 'Sign-in link is invalid or has expired.'
        setError(msg)
        return
      }

      if (!code) {
        // No code — check if we already have a session (e.g. navigated here directly)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace(next)
        } else {
          setError('No sign-in code found. Please request a new link.')
        }
        return
      }

      // Exchange the PKCE code for a session — client-side, so code_verifier is accessible
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange error:', exchangeError.message)
        setError('Sign-in link has expired or already been used. Please request a new one.')
        return
      }

      router.replace(next)
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="animate-fade-in max-w-sm w-full">
          <Logo size="md" />
          <div className="w-8 h-px mx-auto mt-5 mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />
          <p className="text-sm text-mist mb-5 leading-relaxed">{error}</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="btn-primary text-sm px-6 py-2.5"
          >
            Request a new link →
          </button>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-10 h-10 rounded-full animate-spin-slow"
        style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }}
      />
      <p className="text-xs text-mist">Signing you in…</p>
    </main>
  )
}
