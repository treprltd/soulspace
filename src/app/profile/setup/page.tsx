'use client'

// /profile/setup — shown to already-authenticated users who haven't completed
// their profile yet (e.g. users created before the registration form was added).
// Submits directly to POST /api/user/profile (no localStorage needed).

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import { NavBar } from '@/components/ui/NavBar'
import {
  ProfileFields,
  validateProfileFields,
} from '@/components/ui/ProfileFields'

export default function ProfileSetup() {
  const router = useRouter()
  const [next, setNext] = useState('/dashboard')
  const [userEmail, setUserEmail] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [dob, setDob]             = useState('')
  const [phone, setPhone]         = useState('')
  const [gender, setGender]       = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setNext(params.get('next') ?? '/dashboard')

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/signin?next=/profile/setup')
        return
      }
      setUserEmail(user.email ?? '')
      const { data: { session } } = await supabase.auth.getSession()
      setAccessToken(session?.access_token ?? null)
      setCheckingAuth(false)
    })
  }, [router])

  function validate() {
    return validateProfileFields({ firstName, lastName, dob, phone, gender })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({ firstName, lastName, dob, phone, gender }),
    })

    const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
    setLoading(false)

    if (!res.ok) {
      const msg = body.error ?? 'Something went wrong. Please try again.'
      // Route specific errors to the right field
      if (msg.toLowerCase().includes('phone')) {
        setErrors({ phone: msg })
      } else if (msg.toLowerCase().includes('age') || msg.toLowerCase().includes('18')) {
        setErrors({ dob: msg })
      } else {
        setErrors({ _global: msg })
      }
      return
    }

    router.replace(next)
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#060E18' }}>
        <div
          className="w-8 h-8 rounded-full"
          style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.9s linear infinite' }}
        />
      </main>
    )
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div className="px-5 py-8 max-w-sm mx-auto animate-fade-in">

        <div className="text-center mb-6">
          <Logo size="sm" />
          <div className="w-6 h-px mx-auto mt-3 mb-5" style={{ background: 'rgba(201,168,76,.2)' }} />
          <h1 className="font-serif font-light text-sand2 text-2xl mb-1.5">
            One quick step.
          </h1>
          <p className="text-sm text-mist leading-relaxed">
            We need a few details for your account.<br />
            Used only for communications — never shared.
          </p>
        </div>

        {/* Email (read-only) */}
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.06)' }}
        >
          <span className="text-xs tracking-[.08em] uppercase text-mist flex-shrink-0">Account</span>
          <span className="text-xs text-sand truncate">{userEmail}</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

          {errors._global && (
            <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--danger)' }}>
              {errors._global}
            </p>
          )}

          <ProfileFields
            values={{ firstName, lastName, dob, phone, gender }}
            setters={{ setFirstName, setLastName, setDob, setPhone, setGender }}
            errors={errors}
            focusedField={focusedField}
            onFocus={setFocusedField}
            onBlur={() => setFocusedField(null)}
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 mt-1"
          >
            {loading ? 'Saving…' : 'Save and continue →'}
          </button>
        </form>

        <p className="text-xs text-center mt-4 leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
          Your data is encrypted and never sold. CPRA compliant.
        </p>
      </div>
    </main>
  )
}
