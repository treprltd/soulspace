'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  FeedbackRating, FeedbackFrequency, FeedbackEase, FeedbackRecommend, FeedbackRow,
} from '@/types'

interface FeedbackPanelProps {
  authToken: string | null
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
      className="text-[7px] tracking-[.12em] uppercase mb-2"
      style={{ color: 'rgba(139,167,184,.55)' }}
    >
      {children}
    </div>
  )
}

function Question({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-2 mb-2.5">
        <span
          className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-medium mt-0.5"
          style={{ background: 'rgba(201,168,76,.1)', color: 'var(--gold2)', border: '1px solid rgba(201,168,76,.2)' }}
        >
          {n}
        </span>
        {children}
      </div>
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
      className="px-3 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer mr-1.5 mb-1.5"
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
        <span className="text-[10px] self-center ml-1" style={{ color: 'rgba(139,167,184,.5)' }}>
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeedbackPanel({ authToken }: FeedbackPanelProps) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null)

  // Form state
  const [rating, setRating]         = useState<FeedbackRating | null>(null)
  const [frequency, setFrequency]   = useState<FeedbackFrequency | null>(null)
  const [valuable, setValuable]     = useState<string[]>([])
  const [ease, setEase]             = useState<FeedbackEase | null>(null)
  const [improvements, setImprovements] = useState<string[]>([])
  const [recommend, setRecommend]   = useState<FeedbackRecommend | null>(null)
  const [comments, setComments]     = useState('')

  // Load existing feedback on open
  useEffect(() => {
    if (!open || !authToken) return
    const headers: Record<string, string> = { Authorization: `Bearer ${authToken}` }
    fetch('/api/feedback', { headers })
      .then(r => r.json())
      .then(d => {
        const fb = (d as { feedback: FeedbackRow | null }).feedback
        if (!fb) return
        setLastSubmitted(fb.created_at)
        // Pre-fill answers from most recent submission
        if (fb.overall_rating)  setRating(fb.overall_rating as FeedbackRating)
        if (fb.use_frequency)   setFrequency(fb.use_frequency as FeedbackFrequency)
        if (fb.most_valuable?.length)  setValuable(fb.most_valuable)
        if (fb.ease_of_use)     setEase(fb.ease_of_use as FeedbackEase)
        if (fb.improvements?.length)   setImprovements(fb.improvements)
        if (fb.would_recommend) setRecommend(fb.would_recommend as FeedbackRecommend)
        if (fb.comments)        setComments(fb.comments)
      })
      .catch(() => {})
  }, [open, authToken])

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

  async function handleSubmit() {
    setSaving(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      }
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          overall_rating:  rating,
          use_frequency:   frequency,
          most_valuable:   valuable,
          ease_of_use:     ease,
          improvements,
          would_recommend: recommend,
          comments,
        }),
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

  const hasAnyAnswer = !!(rating || frequency || valuable.length || ease || improvements.length || recommend || comments.trim())

  return (
    <>
      {/* ── Fixed tab on right edge ───────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
        style={{
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          padding: '12px 6px',
          background: open ? 'rgba(201,168,76,.15)' : 'rgba(15,30,46,.95)',
          border: '1px solid rgba(201,168,76,.25)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          backdropFilter: 'blur(8px)',
        }}
        aria-label="Open beta feedback"
      >
        {/* Beta badge */}
        <span
          className="text-[7px] tracking-[.1em] uppercase font-medium"
          style={{ color: 'var(--gold)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Beta Feedback
        </span>
        <span style={{ color: 'rgba(201,168,76,.6)', fontSize: '10px' }}>✦</span>
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
                className="text-[7px] tracking-[.12em] uppercase px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(201,168,76,.1)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,.2)' }}
              >
                Beta
              </span>
              <h2 className="font-serif font-light text-sand2" style={{ fontSize: '18px' }}>
                Share your feedback
              </h2>
            </div>
            {lastSubmitted && !submitted && (
              <p className="text-[9px] mt-1" style={{ color: 'rgba(139,167,184,.4)' }}>
                Last submitted {new Date(lastSubmitted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · update any time
              </p>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: 'var(--mist)', background: 'rgba(139,167,184,.06)', border: '1px solid rgba(139,167,184,.1)' }}
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
                <span style={{ color: 'var(--teal2)', fontSize: '24px' }}>✓</span>
              </div>
              <h3 className="font-serif font-light text-sand2 text-xl mb-2">Thank you.</h3>
              <p className="text-xs text-mist leading-relaxed mb-6 max-w-xs">
                Your feedback helps us understand what Soul Space means to you
                and where to take it next.
              </p>
              <p className="text-[10px] mb-6" style={{ color: 'rgba(139,167,184,.5)' }}>
                You can update your feedback any time.
              </p>
              <button
                onClick={resetAndReopen}
                className="btn-outline text-[11px] py-2 px-5"
              >
                Update my feedback →
              </button>
            </div>

          ) : (
            /* ── Form ── */
            <div>
              <p className="text-xs text-mist leading-relaxed mb-6">
                You&apos;re part of our early beta. Your honest experience — what works,
                what doesn&apos;t — shapes everything we build next.
              </p>

              {/* Q1 — Star rating */}
              <div className="mb-5">
                <SectionLabel>1 · Overall experience</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">How would you rate Soul Space so far?</p>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Q2 — Frequency */}
              <div className="mb-5">
                <SectionLabel>2 · Usage</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">How often have you used it?</p>
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

              {/* Q3 — Most valuable */}
              <div className="mb-5">
                <SectionLabel>3 · Most valuable</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">What felt most valuable? <span style={{ color: 'rgba(139,167,184,.45)' }}>Select all that apply.</span></p>
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

              {/* Q4 — Ease of use */}
              <div className="mb-5">
                <SectionLabel>4 · Ease of use</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">How easy was it to navigate?</p>
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

              {/* Q5 — Improvements */}
              <div className="mb-5">
                <SectionLabel>5 · What would improve it</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">What would make it better? <span style={{ color: 'rgba(139,167,184,.45)' }}>Select all that apply.</span></p>
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

              {/* Q6 — Recommend */}
              <div className="mb-5">
                <SectionLabel>6 · Recommendation</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">Would you recommend Soul Space to someone you care about?</p>
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

              {/* Q7 — Free text */}
              <div className="mb-6">
                <SectionLabel>7 · Anything else</SectionLabel>
                <p className="text-[11px] text-sand mb-2.5">Anything else you&apos;d like us to know?</p>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Your honest thoughts — what worked, what felt off, what surprised you…"
                  className="w-full rounded-xl px-3.5 py-3 text-[11px] leading-relaxed resize-none focus:outline-none transition-all"
                  style={{
                    background: 'rgba(15,30,46,.6)',
                    border: comments ? '1px solid rgba(201,168,76,.25)' : '1px solid rgba(245,237,216,.08)',
                    color: 'var(--sand)',
                    caretColor: 'var(--gold)',
                  }}
                />
                {comments.length > 0 && (
                  <div className="text-right text-[9px] mt-1" style={{ color: 'rgba(139,167,184,.35)' }}>
                    {comments.length}/2000
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={saving || !hasAnyAnswer}
                className="btn-primary w-full py-3.5 disabled:opacity-40"
              >
                {saving ? 'Saving…' : lastSubmitted ? 'Update feedback →' : 'Submit feedback →'}
              </button>

              <p className="text-[9px] text-center mt-3 leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
                Your responses are private and used only to improve Soul Space.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
