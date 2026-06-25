'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'

const SUB_OPTIONS: Record<string, string[]> = {
  'Subscription':           ['Refund request', 'Upgrade plan', 'Downgrade plan', 'Cancellation help', 'Billing issue', 'Other subscription question'],
  'General question':       ['How Soul Space works', 'Pricing & plans', 'Privacy & security', 'Accessibility', 'Other'],
  'Feedback':               ['Session experience', 'Mirror accuracy', 'Feature request', 'General feedback'],
  'Technical issue':        ["Can't sign in", 'Session not loading', 'Mirror not responding', 'Something looks broken', 'Other'],
  'Privacy / data request': ['Download my data', 'Delete my account', 'Data correction', 'Cookie preferences', 'Other'],
  'Press or partnership':   ['Media inquiry', 'Partnership proposal', 'Research inquiry', 'Other'],
  'Other':                  [],
}

const CATEGORIES = Object.keys(SUB_OPTIONS) as Category[]
type Category = keyof typeof SUB_OPTIONS

interface FormState {
  name:      string
  email:     string
  category:  Category | ''
  subOption: string
  message:   string
}

const EMPTY: FormState = { name: '', email: '', category: '', subOption: '', message: '' }

const CHEVRON_BG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238BA7B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")"

export default function Contact() {
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [errors, setErrors]         = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSub]        = useState(false)
  const [sent, setSent]             = useState(false)
  const [serverErr, setServerErr]   = useState<string | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setAuthLoaded(true); return }
      const email = session.user.email ?? ''
      let fullName = ''
      try {
        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const p = await res.json() as { first_name?: string | null; last_name?: string | null }
          fullName = [p.first_name, p.last_name].filter(Boolean).join(' ')
        }
      } catch { /* non-blocking */ }
      setForm(f => ({ ...f, email: email || f.email, name: fullName || f.name }))
      setAuthLoaded(true)
    })
  }, [])

  const subOptions   = form.category ? (SUB_OPTIONS[form.category] ?? []) : []
  const hasSubOptions = subOptions.length > 0

  function setCategory(cat: Category | '') {
    setForm(f => ({ ...f, category: cat, subOption: '' }))
    setErrors(er => ({ ...er, category: undefined, subOption: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim())                                             e.name      = 'Please enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))        e.email     = 'Please enter a valid email address.'
    if (!form.category)                                                e.category  = 'Please select a category.'
    if (hasSubOptions && !form.subOption)                              e.subOption = 'Please select a sub-topic.'
    if (form.message.trim().length < 10)                               e.message   = 'Message must be at least 10 characters.'
    if (form.message.trim().length > 4000)                             e.message   = 'Message cannot exceed 4,000 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerErr(null)
    if (!validate()) return
    setSub(true)
    try {
      const res  = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setServerErr(data.error ?? 'Something went wrong. Please try again.'); setSub(false); return }
      setSent(true)
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch {
      setServerErr('A network error occurred. Please check your connection and try again.')
      setSub(false)
    }
  }

  const inputStyle = (hasErr: boolean): React.CSSProperties => ({
    background: 'rgba(15,30,46,.7)', border: `1px solid ${hasErr ? 'rgba(212,64,64,.6)' : 'rgba(245,237,216,.08)'}`,
    borderRadius: '10px', color: 'var(--sand2)', fontSize: '14px', padding: '12px 14px',
    outline: 'none', width: '100%', transition: 'border-color .15s', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  })

  const selectStyle = (hasErr: boolean): React.CSSProperties => ({
    ...inputStyle(hasErr), appearance: 'none' as const, WebkitAppearance: 'none' as const,
    backgroundImage: CHEVRON_BG, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
    paddingRight: '36px', cursor: 'pointer',
  })

  const focusCls = 'focus:outline-none focus:ring-0'

  function FieldMeta({ id, label, hint }: { id: keyof FormState; label: string; hint?: string }) {
    return (
      <div className="flex flex-col gap-1" style={{ marginBottom: '6px' }}>
        <label htmlFor={id} className="text-xs tracking-wide" style={{ color: 'rgba(213,226,235,.72)' }}>{label}</label>
        {hint && <p className="text-[13px]" style={{ color: 'rgba(139,167,184,.6)' }}>{hint}</p>}
        {errors[id] && <p className="text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{errors[id]}</p>}
      </div>
    )
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div ref={topRef} className="max-w-xl mx-auto px-6 pt-14 pb-24">

        <div className="eyebrow mb-3">Get in touch</div>
        <h1 className="font-serif font-light leading-tight mb-3" style={{ fontSize: 'clamp(26px, 5vw, 42px)', color: 'var(--sand2)' }}>
          We&rsquo;re here if<br /><em className="text-gold2">something comes up.</em>
        </h1>
        <p className="text-sm mb-10 leading-relaxed" style={{ color: 'rgba(213,226,235,.62)', maxWidth: '380px' }}>
          Questions, feedback, subscription help, or data requests — send us a note and we&rsquo;ll reply within 1&ndash;2 business days.
        </p>

        <div className="rounded-xl px-4 py-3.5 mb-8 text-sm leading-relaxed" style={{ background: 'rgba(42,140,122,.07)', border: '1px solid rgba(42,140,122,.2)' }}>
          <span style={{ color: 'var(--teal2)', fontWeight: 600 }}>Not a crisis line.</span>{' '}
          <span style={{ color: 'rgba(213,226,235,.7)' }}>
            If you are in immediate danger, please call or text{' '}
            <a href="tel:988" style={{ color: 'var(--teal2)', textDecoration: 'underline' }}>988</a>{' '}
            or visit <Link href="/crisis" style={{ color: 'var(--teal2)', textDecoration: 'underline' }}>crisis resources</Link>.
          </span>
        </div>

        {sent ? (
          <div className="rounded-2xl px-6 py-8 text-center" style={{ background: 'rgba(15,30,46,.8)', border: '1px solid rgba(201,168,76,.15)' }}>
            <div className="text-2xl mb-3" aria-hidden>&#10022;</div>
            <h2 className="font-serif font-light text-sand2 text-xl mb-2">Message received.</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(213,226,235,.66)' }}>
              We&rsquo;ll be in touch within 1&ndash;2 business days. A confirmation was sent to{' '}
              <span style={{ color: 'var(--gold2)' }}>{form.email}</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/" className="btn-primary text-sm px-6 py-3">Back to Soul Space</Link>
              <button onClick={() => { setForm(EMPTY); setErrors({}); setSent(false) }} className="btn-outline text-sm px-6 py-3">
                Send another message
              </button>
            </div>
          </div>
        ) : (

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldMeta id="name" label="Your name" />
              <input id="name" type="text" autoComplete="name" value={form.name} maxLength={100}
                placeholder={authLoaded ? 'Ada Lovelace' : ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onFocus={() => setErrors(er => ({ ...er, name: undefined }))}
                className={focusCls} style={inputStyle(!!errors.name)} />
            </div>
            <div>
              <FieldMeta id="email" label="Email address" />
              <input id="email" type="email" autoComplete="email" value={form.email}
                placeholder={authLoaded ? 'ada@example.com' : ''}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                onFocus={() => setErrors(er => ({ ...er, email: undefined }))}
                className={focusCls} style={inputStyle(!!errors.email)} />
            </div>
          </div>

          <div className={`grid gap-5 ${hasSubOptions ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <FieldMeta id="category" label="What is this about?" />
              <select id="category" value={form.category}
                onChange={e => setCategory(e.target.value as Category | '')}
                className={focusCls} style={selectStyle(!!errors.category)}>
                <option value="" disabled style={{ background: '#0F1E2E' }}>Select a category&hellip;</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c} style={{ background: '#0F1E2E', color: '#F5EDD8' }}>{c}</option>
                ))}
              </select>
            </div>

            {hasSubOptions && (
              <div>
                <FieldMeta id="subOption" label="Specifically&hellip;" />
                <select id="subOption" value={form.subOption}
                  onChange={e => { setForm(f => ({ ...f, subOption: e.target.value })); setErrors(er => ({ ...er, subOption: undefined })) }}
                  className={focusCls} style={selectStyle(!!errors.subOption)}>
                  <option value="" disabled style={{ background: '#0F1E2E' }}>Select&hellip;</option>
                  {subOptions.map(opt => (
                    <option key={opt} value={opt} style={{ background: '#0F1E2E', color: '#F5EDD8' }}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <FieldMeta id="message" label="Your message" hint="Please do not include sensitive health or personal information." />
            <textarea id="message" rows={6} value={form.message} maxLength={4000}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              onFocus={() => setErrors(er => ({ ...er, message: undefined }))}
              className={focusCls}
              style={{ ...inputStyle(!!errors.message), resize: 'vertical', minHeight: '140px', lineHeight: '1.7' }}
              placeholder="What would you like to share or ask?" />
            <p className="text-[13px] mt-1 text-right" style={{ color: 'rgba(139,167,184,.45)' }}>{form.message.length} / 4,000</p>
          </div>

          {serverErr && (
            <div className="rounded-xl px-4 py-3 text-sm" role="alert"
              style={{ background: 'rgba(212,64,64,.08)', border: '1px solid rgba(212,64,64,.25)', color: 'rgba(212,64,64,.9)' }}>
              {serverErr}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary text-sm px-8 py-3.5 w-full sm:w-auto self-start"
            style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Sending…' : 'Send message →'}
          </button>

          <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(139,167,184,.5)' }}>
            By submitting this form you agree to our{' '}
            <Link href="/privacy" style={{ color: 'rgba(139,167,184,.75)', textDecoration: 'underline' }}>Privacy Policy</Link>.
            We do not sell or share your information.
          </p>

        </form>
        )}
      </div>

      <footer className="px-8 py-8 text-center" style={{ borderTop: '1px solid rgba(245,237,216,.04)' }}>
        <p className="font-serif font-light text-sand2 text-sm mb-1">Soul <em className="not-italic text-gold font-normal">Space</em></p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(213,226,235,.62)' }}>
          Affirm. Ask. Reflect. &middot; Non-clinical &middot; Non-diagnostic &middot; Not a crisis service<br />
          If you are in immediate danger, call or text 988.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          <Link href="/" className="text-xs text-mist/80 hover:text-mist transition-colors">Home</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>&middot;</span>
          <Link href="/pricing" className="text-xs text-mist/80 hover:text-mist transition-colors">Pricing</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>&middot;</span>
          <Link href="/crisis" className="text-xs text-mist/80 hover:text-mist transition-colors">Crisis resources</Link>
          <span className="text-xs" style={{ color: 'rgba(213,226,235,.56)' }}>&middot;</span>
          <Link href="/privacy" className="text-xs text-mist/80 hover:text-mist transition-colors">Privacy</Link>
        </div>
      </footer>
    </main>
  )
}
