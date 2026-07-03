'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  FeedbackRating, FeedbackFrequency, FeedbackEase, FeedbackRecommend, FeedbackRow,
} from '@/types'

interface FeedbackPanelProps {
  authToken: string | null
  /** When true the panel slides open immediately on mount (e.g. after session completion). */
  defaultOpen?: boolean
}

// ── Option sets ───────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: FeedbackFrequency; label: string }[] = [
  { value: 'first_time',    label: 'First time' },
  { value: 'few_times',     label: 'A few times' },
  { value: 'weekly',        label: 'Weekly' },
  { value: 'daily_or_more', label: 'Daily or more' },
]

const VALUABLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'mirror_reflection', label: 'The Mirror reflection' },
  { value: 'season_insights',   label: 'Season insights' },
  { value: 'next_step',         label: 'Next step guidance' },
  { value: 'privacy_security',  label: 'Privacy & security' },
  { value: 'calming_design',    label: 'The calm design' },
  { value: 'questions_asked',   label: 'Questions asked' },
]

const EASE_OPTIONS: { value: FeedbackEase; label: string }[] = [
  { value: 'very_difficult', label: 'Very difficult' },
  { value: 'difficult',      label: 'Difficult' },
  { value: 'neutral',        label: 'Neutral' },
  { value: 'easy',           label: 'Easy' },
  { value: 'very_easy',      label: 'Very easy' },
]

const IMPROVEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'deeper_reflections', label: 'Deeper reflections' },
  { value: 'more_topics',        label: 'More session topics' },
  { value: 'session_insights',   label: 'Session history insights' },
  { value: 'audio_input',        label: 'Voice / audio input' },
  { value: 'therapist_sharing',  label: 'Share with a therapist' },
  { value: 'mobile_app',         label: 'Native mobile app' },
  { value: 'nothing',            label: 'Nothing — it works' },
]

const RECOMMEND_OPTIONS: { value: FeedbackRecommend; label: string }[] = [
  { value: 'yes_already', label: 'Yes — already have' },
  { value: 'yes_likely',  label: 'Yes, likely' },
  { value: 'maybe',       label: 'Maybe' },
  { value: 'not_yet',     label: 'Not yet' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[17px] tracking-[.12em] uppercase mb-2"
      style={{ color: 'rgba(213,226,235,.72)' }}
    >
      {children}
    </div>
  )
}

function ChoiceChip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[18px] transition-all cursor-pointer mr-1.5 mb-1.5"
      style={{
        border: selected ? '1px solid rgba(201,168,76,.5)' : '1px solid rgba(245,237,216,.1)',
        background: selected ? 'rgba(201,168,76,.1)' : 'transparent',
        color: selected ? 'var(--gold2)' : 'rgba(139,167,184,.65)',
      }}
    >
      {selected && <span className="mr-1">✓</span>}{label}
    </button>
  )
}

function StarRating({
  value, onChange,
}: { value: FeedbackRating | null; onChange: (v: FeedbackRating) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const stars = [1, 2, 3, 4, 5] as FeedbackRating[]
  const active = hover ?? value ?? 0

  return (
    <div className="flex gap-2">
      {stars.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className="text-xl transition-all cursor-pointer"
          style={{
            color: n <= active ? 'var(--gold)' : 'rgba(201,168,76,.2)',
            transform: n <= active ? 'scale(1.1)' : 'scale(1)',
          }}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
      {value && (
        <span className="text-[18px] self-center ml-1" style={{ color: 'rgba(213,226,235,.72)' }}>
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </span>
      )}
    </div>
  )
}

// ── Email validation helper ───────────────────────────────────────────────────

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeedbackPanel({ authToken, defaultOpen = false }: FeedbackPanelProps) {
  const isGuest = !authToken

  const [open, setOpen]               = useState(defaultOpen)
  const [submitted, setSubmitted]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null)

  // React to prop changes: FeedbackWrapper is persistent in the layout so
  // this component never unmounts on navigation. useState(defaultOpen) only
  // reads the initial value — we need this effect to open the panel whenever
  // the parent sets defaultOpen=true (e.g. on /session/next-step).
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  // Guest email (mandatory for guests)
  const [guestEmail, setGuestEmail]   = useState('')
  const [emailTouched, setEmailTouched] = useState(false)

  // Form state
  const [rating, setRating]               = useState<FeedbackRating | null>(null)
  const [frequency, setFrequency]         = useState<FeedbackFrequency | null>(null)
  const [valuable, setValuable]           = useState<string[]>([])
  const [ease, setEase]                   = useState<FeedbackEase | null>(null)
  const [improvements, setImprovements]   = useState<string[]>([])
  const [recommend, setRecommend]         = useState<FeedbackRecommend | null>(null)
  const [comments, setComments]           = useState('')

  // Quick-feedback fields (Reddit beta campaign) — composed into `comments`
  // at submit time rather than new DB columns, so no schema/migration risk.
  const [personalOrGeneric, setPersonalOrGeneric] = useState<'Personal' | 'Mixed' | 'Generic' | null>(null)
  const [confused, setConfused]           = useState('')
  const [showMore, setShowMore]           = useState(false)

  // Load existing feedback on open (authenticated users only)
  useEffect(() => {
    if (!open || isGuest) return
    const headers: Record<string, string> = { Authorization: `Bearer ${authToken}` }
    fetch('/api/feedback', { headers })
      .then(r => r.json())
      .then(d => {
        const fb = (d as { feedback: FeedbackRow | null }).feedback
        if (!fb) return
        setLastSubmitted(fb.created_at)
        // Pre-fill answers from most recent submission
        if (fb.overall_rating)        setRating(fb.overall_rating as FeedbackRating)
        if (fb.use_frequency)         setFrequency(fb.use_frequency as FeedbackFrequency)
        if (fb.most_valuable?.length) setValuable(fb.most_valuable)
        if (fb.ease_of_use)           setEase(fb.ease_of_use as FeedbackEase)
        if (fb.improvements?.length)  setImprovements(fb.improvements)
        if (fb.would_recommend)       setRecommend(fb.would_recommend as FeedbackRecommend)
        if (fb.comments)              setComments(fb.comments)
      })
      .catch(() => {})
  }, [open, authToken, isGuest])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const toggleMulti = useCallback((arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }, [])

  const emailError = isGuest && emailTouched && !isValidEmail(guestEmail)
    ? 'Please enter a valid email address.'
    : null

  async function handleSubmit() {
    // Guests must provide a valid email before submitting
    if (isGuest) {
      setEmailTouched(true)
      if (!isValidEmail(guestEmail)) return
    }

    setSaving(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      }
      // Quick-feedback questions have no dedicated DB columns — compose them
      // into `comments` as clearly labeled sections instead of a migration.
      const composedComments = [
        personalOrGeneric ? `Personal or generic: ${personalOrGeneric}` : null,
        confused.trim()   ? `What confused them: ${confused.trim()}`    : null,
        comments.trim()   ? `Would use again: ${comments.trim()}`      : null,
      ].filter(Boolean).join('\n\n')
      const payload: Record<string, unknown> = {
        overall_rating:  rating,
        use_frequency:   frequency,
        most_valuable:   valuable,
        ease_of_use:     ease,
        improvements,
        would_recommend: recommend,
        comments:        composedComments,
      }
      if (isGuest) {
        payload.guest_email = guestEmail.toLowerCase().trim()
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setSubmitted(true)
        setLastSubmitted(new Date().toISOString())
      }
    } catch { /* noop */ } finally {
      setSaving(false)
    }
  }

  function resetAndReopen() {
    setSubmitted(false)
  }

  const hasAnyAnswer = !!(
    rating || frequency || valuable.length || ease || improvements.length || recommend ||
    comments.trim() || personalOrGeneric || confused.trim()
  )
  // Guests need a valid email AND at least one answer
  const canSubmit = isGuest
    ? hasAnyAnswer && isValidEmail(guestEmail)
    : hasAnyAnswer

  return (
    <>
      {/* ── Fixed tab on right edge ───────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 flex flex-col items-center justify-center gap-2 cursor-pointer feedback-tab"
        style={{
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          padding: '18px 10px',
          background: open
            ? 'rgba(201,168,76,.22)'
            : 'linear-gradient(180deg, rgba(201,168,76,.18) 0%, rgba(15,30,46,.98) 100%)',
          border: '1px solid rgba(201,168,76,.55)',
          borderRight: 'none',
          borderRadius: '10px 0 0 10px',
          backdropFilter: 'blur(12px)',
          boxShadow: open
            ? 'none'
            : '-3px 0 20px rgba(201,168,76,.18), inset 0 1px 0 rgba(201,168,76,.25)',
          transition: 'all .2s ease',
        }}
        aria-label="Open beta feedback"
      >
        {/* Star icon */}
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="currentColor"
          style={{ color: 'var(--gold)', flexShrink: 0 }}
        >
          <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
        </svg>

        {/* Label */}
        <span
          className="font-medium tracking-[.13em] uppercase"
          style={{
            color: 'var(--gold2)',
            fontSize: '16px',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            letterSpacing: '0.14em',
          }}
        >
          Beta Feedback
        </span>

        {/* Pulse dot */}
        <span
          className="rounded-full flex-shrink-0"
          style={{
            width: '6px',
            height: '6px',
            background: 'var(--gold)',
            boxShadow: '0 0 6px rgba(201,168,76,.8)',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }}
        />
      </button>

      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(6,14,24,.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sliding panel ────────────────────────────────────────────── */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: '#0A1628',
          borderLeft: '1px solid rgba(201,168,76,.15)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(245,237,216,.06)' }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[16px] tracking-[.12em] uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(201,168,76,.1)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,.2)' }}
              >
                Beta
              </span>
              <h2 className="font-serif font-light text-sand2" style={{ fontSize: '23px' }}>
                Share your feedback
              </h2>
            </div>
            {lastSubmitted && !submitted && (
              <p className="text-[17px] mt-1" style={{ color: 'rgba(213,226,235,.65)' }}>
                Last submitted {new Date(lastSubmitted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · update any time
              </p>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: 'var(--mist)', background: 'rgba(139,167,184,.06)', border: '1px solid rgba(213,226,235,.52)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-5">

          {/* ── Thank-you state ── */}
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                style={{ background: 'rgba(42,140,122,.1)', border: '1px solid rgba(42,140,122,.3)' }}
              >
                <span style={{ color: 'var(--teal2)', fontSize: '30px' }}>✓</span>
              </div>
              <h3 className="font-serif font-light text-sand2 text-xl mb-2">Thank you.</h3>
              <p className="text-xs text-mist leading-relaxed mb-6 max-w-xs">
                Your feedback helps us understand what Soul Space means to you
                and where to take it next.
              </p>
              {!isGuest && (
                <>
                  <p className="text-[18px] mb-6" style={{ color: 'rgba(213,226,235,.72)' }}>
                    You can update your feedback any time.
                  </p>
                  <button
                    onClick={resetAndReopen}
                    className="btn-outline text-[18px] py-2 px-5"
                  >
                    Update my feedback →
                  </button>
                </>
              )}
            </div>

          ) : (
            /* ── Form ── */
            <div>
              <p className="text-xs text-mist leading-relaxed mb-6">
                You&apos;re part of our early beta. Your honest experience — what works,
                what doesn&apos;t — shapes everything we build next.
              </p>

              {/* Guest email field — mandatory for non-authenticated users */}
              {isGuest && (
                <div className="mb-6">
                  <SectionLabel>Your email address</SectionLabel>
                  <p className="text-[19px] mb-2" style={{ color: 'var(--sand)' }}>
                    Required so we can follow up if needed.
                    <span className="ml-1" style={{ color: 'rgba(212,64,64,.8)' }}>*</span>
                  </p>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full rounded-xl px-3.5 py-3 text-[19px] focus:outline-none transition-all"
                    style={{
                      background: 'rgba(15,30,46,.6)',
                      border: emailError
                        ? '1px solid rgba(212,64,64,.5)'
                        : guestEmail && isValidEmail(guestEmail)
                          ? '1px solid rgba(42,140,122,.4)'
                          : '1px solid rgba(245,237,216,.08)',
                      color: 'var(--sand)',
                      caretColor: 'var(--gold)',
                    }}
                  />
                  {emailError && (
                    <p className="text-[18px] mt-1.5" style={{ color: 'rgba(212,64,64,.8)' }}>
                      {emailError}
                    </p>
                  )}
                  {!emailError && guestEmail && isValidEmail(guestEmail) && (
                    <p className="text-[18px] mt-1.5" style={{ color: 'rgba(42,140,122,.7)' }}>
                      ✓ Looks good
                    </p>
                  )}
                  <div
                    className="mt-3 px-3 py-2.5 rounded-lg text-[18px] leading-relaxed"
                    style={{ background: 'rgba(139,167,184,.05)', border: '1px solid rgba(213,226,235,.52)', color: 'rgba(213,226,235,.72)' }}
                  >
                    We use your email only for Soul Space product updates. Never shared.
                  </div>
                </div>
              )}

              {/* Star rating — optional */}
              <div className="mb-5">
                <SectionLabel>Overall experience (optional)</SectionLabel>
                <p className="text-[19px] text-sand mb-2.5">How would you rate Soul Space so far?</p>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Q1 — Personal or generic */}
              <div className="mb-5">
                <SectionLabel>Did the Mirror feel personal?</SectionLabel>
                <p className="text-[19px] text-sand mb-2.5">Did the Mirror feel personal or generic?</p>
                <div className="flex flex-wrap">
                  {(['Personal', 'Mixed', 'Generic'] as const).map(opt => (
                    <ChoiceChip
                      key={opt}
                      label={opt}
                      selected={personalOrGeneric === opt}
                      onClick={() => setPersonalOrGeneric(opt)}
                    />
                  ))}
                </div>
              </div>

              {/* Q2 — What confused you */}
              <div className="mb-5">
                <SectionLabel>Anything confusing?</SectionLabel>
                <p className="text-[19px] text-sand mb-2.5">What confused you, if anything?</p>
                <textarea
                  value={confused}
                  onChange={e => setConfused(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Anything, or leave blank"
                  className="w-full rounded-xl px-3.5 py-3 text-[19px] leading-relaxed resize-none focus:outline-none transition-all"
                  style={{
                    background: 'rgba(15,30,46,.6)',
                    border: confused ? '1px solid rgba(201,168,76,.25)' : '1px solid rgba(245,237,216,.08)',
                    color: 'var(--sand)',
                    caretColor: 'var(--gold)',
                  }}
                />
              </div>

              {/* Q3 — Would use again */}
              <div className="mb-6">
                <SectionLabel>Would you return?</SectionLabel>
                <p className="text-[19px] text-sand mb-2.5">Would you use this again? Why or why not?</p>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="A sentence or two is plenty"
                  className="w-full rounded-xl px-3.5 py-3 text-[19px] leading-relaxed resize-none focus:outline-none transition-all"
                  style={{
                    background: 'rgba(15,30,46,.6)',
                    border: comments ? '1px solid rgba(201,168,76,.25)' : '1px solid rgba(245,237,216,.08)',
                    color: 'var(--sand)',
                    caretColor: 'var(--gold)',
                  }}
                />
              </div>

              {/* Optional extra questions — collapsed by default so the form
                  doesn't feel long. Same fields as before, just de-emphasized. */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowMore(v => !v)}
                  className="text-[18px] underline underline-offset-2 cursor-pointer"
                  style={{ color: 'rgba(213,226,235,.6)', background: 'none', border: 'none' }}
                >
                  {showMore ? '− Fewer questions' : '+ A few more questions (optional)'}
                </button>

                {showMore && (
                  <div className="mt-4 animate-fade-in">
                    <div className="mb-5">
                      <SectionLabel>Usage</SectionLabel>
                      <p className="text-[19px] text-sand mb-2.5">How often have you used it?</p>
                      <div className="flex flex-wrap">
                        {FREQUENCY_OPTIONS.map(o => (
                          <ChoiceChip
                            key={o.value}
                            label={o.label}
                            selected={frequency === o.value}
                            onClick={() => setFrequency(o.value)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <SectionLabel>Most valuable</SectionLabel>
                      <p className="text-[19px] text-sand mb-2.5">What felt most valuable? <span style={{ color: 'rgba(213,226,235,.65)' }}>Select all that apply.</span></p>
                      <div className="flex flex-wrap">
                        {VALUABLE_OPTIONS.map(o => (
                          <ChoiceChip
                            key={o.value}
                            label={o.label}
                            selected={valuable.includes(o.value)}
                            onClick={() => toggleMulti(valuable, o.value, setValuable)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <SectionLabel>Ease of use</SectionLabel>
                      <p className="text-[19px] text-sand mb-2.5">How easy was it to navigate?</p>
                      <div className="flex flex-wrap">
                        {EASE_OPTIONS.map(o => (
                          <ChoiceChip
                            key={o.value}
                            label={o.label}
                            selected={ease === o.value}
                            onClick={() => setEase(o.value)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <SectionLabel>What would improve it</SectionLabel>
                      <p className="text-[19px] text-sand mb-2.5">What would make it better? <span style={{ color: 'rgba(213,226,235,.65)' }}>Select all that apply.</span></p>
                      <div className="flex flex-wrap">
                        {IMPROVEMENT_OPTIONS.map(o => (
                          <ChoiceChip
                            key={o.value}
                            label={o.label}
                            selected={improvements.includes(o.value)}
                            onClick={() => toggleMulti(improvements, o.value, setImprovements)}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <SectionLabel>Recommendation</SectionLabel>
                      <p className="text-[19px] text-sand mb-2.5">Would you recommend Soul Space to someone you care about?</p>
                      <div className="flex flex-wrap">
                        {RECOMMEND_OPTIONS.map(o => (
                          <ChoiceChip
                            key={o.value}
                            label={o.label}
                            selected={recommend === o.value}
                            onClick={() => setRecommend(o.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={saving || !canSubmit}
                className="btn-primary w-full py-3.5 disabled:opacity-40"
              >
                {saving ? 'Saving…' : lastSubmitted ? 'Update feedback →' : 'Submit feedback →'}
              </button>

              {isGuest && (
                <p className="text-[17px] text-center mt-2 leading-relaxed" style={{ color: 'rgba(213,226,235,.60)' }}>
                  Email required · never shared · used only to improve Soul Space.
                </p>
              )}
              {!isGuest && (
                <p className="text-[17px] text-center mt-3 leading-relaxed" style={{ color: 'rgba(213,226,235,.60)' }}>
                  Your responses are private and used only to improve Soul Space.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
