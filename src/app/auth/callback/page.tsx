'use client'

// Auth callback — handles implicit flow.
// With implicit flow, Supabase returns the access_token in the URL hash fragment.
// The Supabase browser client detects this automatically via detectSessionInUrl.
// We just listen for the SIGNED_IN event and redirect.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const next = new URLSearchParams(window.location.search).get('next') ?? '/start'

    // Check for error params Supabase may pass in the URL
    const hash = window.location.hash
    const hashParams = new URLSearchParams(hash.replace('#', ''))
    const errorInHash = hashParams.get('error')
    const errorDesc = hashParams.get('error_description')

    if (errorInHash) {
      setError(
        errorDesc
          ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
          : 'Sign-in link is invalid or has expired.'
      )
      return
    }

    // With implicit flow, onAuthStateChange fires with SIGNED_IN
    // as soon as the client detects the token in the URL hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace(next)
        return
      }
      // INITIAL_SESSION fires first — if no session and no hash token, something went wrong
      if (event === 'INITIAL_SESSION' && !session && !hash.includes('access_token')) {
        // Give it 2s for the hash processing, then error out
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession()
          if (!s) setError('Sign-in link has expired or already been used. Please request a new one.')
          else router.replace(next)
        }, 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (error) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: '#060E18' }}
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
      style={{ background: '#060E18' }}
    >
      <div
        className="w-10 h-10 rounded-full animate-spin-slow"
        style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }}
      />
      <p className="text-xs text-mist">Signing you in…</p>
    </main>
  )
}
