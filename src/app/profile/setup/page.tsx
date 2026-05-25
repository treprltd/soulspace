'use client'

// /profile/setup — shown to already-authenticated users who haven't completed
// their profile yet (e.g. users created before the registration form was added).
// Submits directly to POST /api/user/profile (no localStorage needed).

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import { NavBar } from '@/components/ui/NavBar'

const inputClass = `
  w-full px-4 py-3 rounded-xl text-sm text-sand2 focus:outline-none transition-colors
  placeholder:text-mist/40
`.trim()

const inputStyle = {
  background: 'rgba(245,237,216,.04)',
  border: '1px solid rgba(245,237,216,.08)',
}

const inputFocusStyle = {
  background: 'rgba(245,237,216,.04)',
  border: '1px solid rgba(201,168,76,.35)',
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] tracking-[.08em] uppercase text-mist pl-0.5">{label}</label>
      {children}
      {hint && !error && (
        <p className="text-[9px] pl-0.5" style={{ color: 'rgba(139,167,184,.4)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

export default function ProfileSetup() {
  const router = useRouter()
  const [next, setNext] = useState('/dashboard')
  const [userEmail, setUserEmail] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [dob, setDob]             = useState('')
  const [phone, setPhone]         = useState('')
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
    const errs: Record<string, string> = {}
    if (!firstName.trim()) errs.firstName = 'First name is required.'
    if (!lastName.trim())  errs.lastName  = 'Last name is required.'

    if (!dob) {
      errs.dob = 'Date of birth is required.'
    } else {
      const dobDate = new Date(dob)
      const threshold = new Date()
      threshold.setFullYear(threshold.getFullYear() - 18)
      if (isNaN(dobDate.getTime()) || dobDate > threshold) {
        errs.dob = 'You must be 18 or older.'
      }
    }

    const digits = phone.replace(/\D/g, '')
    if (!phone.trim()) {
      errs.phone = 'Phone number is required.'
    } else if (digits.length < 7 || digits.length > 15) {
      errs.phone = 'Please enter a valid phone number (include country code).'
    }

    return errs
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
      body: JSON.stringify({ firstName, lastName, dob, phone }),
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
          <p className="text-xs text-mist leading-relaxed">
            We need a few details for your account.<br />
            Used only for communications — never shared.
          </p>
        </div>

        {/* Email (read-only) */}
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.06)' }}
        >
          <span className="text-[9px] tracking-[.08em] uppercase text-mist flex-shrink-0">Account</span>
          <span className="text-xs text-sand truncate">{userEmail}</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

          {errors._global && (
            <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--danger)' }}>
              {errors._global}
            </p>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" error={errors.firstName}>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
                placeholder="Jane"
                autoComplete="given-name"
                className={inputClass}
                style={focusedField === 'firstName' ? inputFocusStyle : inputStyle}
              />
            </Field>
            <Field label="Last name" error={errors.lastName}>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
                placeholder="Doe"
                autoComplete="family-name"
                className={inputClass}
                style={focusedField === 'lastName' ? inputFocusStyle : inputStyle}
              />
            </Field>
          </div>

          <Field label="Date of birth" error={errors.dob}>
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              onFocus={() => setFocusedField('dob')}
              onBlur={() => setFocusedField(null)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                .toISOString()
                .split('T')[0]}
              autoComplete="bday"
              className={inputClass}
              style={{
                ...(focusedField === 'dob' ? inputFocusStyle : inputStyle),
                colorScheme: 'dark',
              }}
            />
          </Field>

          <Field
            label="Phone number"
            hint="Include country code. Used only for account communications."
            error={errors.phone}
          >
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              placeholder="+1 555 000 0000"
              autoComplete="tel"
              className={inputClass}
              style={focusedField === 'phone' ? inputFocusStyle : inputStyle}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 mt-1"
          >
            {loading ? 'Saving…' : 'Save and continue →'}
          </button>
        </form>

        <p className="text-[9px] text-center mt-4 leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
          Your data is encrypted and never sold. CPRA compliant.
        </p>
      </div>
    </main>
  )
}
