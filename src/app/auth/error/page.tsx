'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const ERROR_MESSAGES: Record<string, string> = {
  'access_denied': 'Access was denied. Your sign-in link may have expired or already been used.',
  'expired_link': 'This sign-in link has expired. Links are valid for 1 hour.',
  'invalid_token': 'This sign-in link is no longer valid.',
}

export default function AuthError() {
  const [message, setMessage] = useState('There was a problem signing you in. Your link may have expired or already been used.')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('error_code') ?? params.get('error') ?? ''
    if (code && ERROR_MESSAGES[code]) setMessage(ERROR_MESSAGES[code])
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: '#060E18' }}>
      <div className="w-full max-w-sm text-center animate-fade-in">
        <Logo size="md" />
        <div className="w-8 h-px mx-auto mt-4 mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />
        <h2 className="font-serif font-light text-sand2 text-xl mb-3">Sign-in problem.</h2>
        <p className="text-sm text-mist mb-6 leading-relaxed">{message}</p>
        <Link href="/auth/signin" className="btn-primary text-sm px-6 py-2.5 inline-block mb-3">
          Request a new link →
        </Link>
        <br />
        <Link href="/" className="text-[18px] underline underline-offset-4" style={{ color: 'rgba(213,226,235,.65)' }}>
          Return home
        </Link>
      </div>
    </main>
  )
}
