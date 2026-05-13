'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'

const NEXT_STEPS = [
  'Write down the two things that are in tension, side by side, without trying to resolve them yet.',
  'Give yourself permission to not decide anything today — just for the next 24 hours.',
  'Talk to one person you trust — not to get advice, just to say it out loud.',
  'Take a 10-minute walk without your phone. Notice what rises up when you\'re quiet.',
  'Write one sentence about what you actually want — not what you think you should want.',
  'Set aside 15 minutes tomorrow morning to sit with this — not to decide, just to notice.',
  'Notice where in your body this feels heaviest. Name it without trying to move it.',
  'Cancel or postpone one non-essential thing today to give yourself more space.',
  'Write a letter to yourself from six months from now — what might you understand then?',
  'Do one thing that has nothing to do with this — something that restores you.',
  'Ask yourself: what would I tell a close friend in exactly this situation?',
  'Name what you are most afraid of. Just saying it clearly sometimes changes its shape.',
  'Consider what staying with this would cost — and what leaving it would cost.',
  'Observe one moment today when this weight lifts, even slightly. Just notice it.',
  'Give yourself credit for simply recognising what you are carrying. That takes honesty.',
  'Rest without resolution. Some things clarify only after stillness.',
  'Reach out to one person — not for answers, just to feel less alone in this.',
  'Write the question you are actually asking — beneath the situation itself.',
  'Choose not to act today. Inaction is also a choice, and sometimes the right one.',
  'Return to Soul Space in a few days. Your season may already be shifting.',
]

interface SubStatus {
  planTier: string
  sessionsThisMonth: number | null
  limit: number | null
  authenticated: boolean
}

export default function NextStep() {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [done, setDone] = useState(false)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => setSubStatus(d as SubStatus))
      .catch(() => {})
  }, [])

  const handleDone = async () => {
    setDone(true)
    const sessionId = sessionStorage.getItem('ss_session_id')
    if (sessionId) {
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' }).catch(() => {})
    }
    // Clear session state
    ;['ss_branch','ss_emotions','ss_intensity','ss_context','ss_mirror','ss_resonance','ss_session_id']
      .forEach(k => sessionStorage.removeItem(k))
    router.push('/')
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <NavBar right="Your next step" />
      <div className="px-6 py-5 max-w-xl mx-auto animate-fade-in">
        {/* AFFIRMATION MOMENT 5 — frozen copy */}
        <div className="affirm-copy mb-3">
          You do not need to resolve anything today.<br />
          One small thing is enough.
        </div>

        <h2 className="font-serif font-light text-sand2 text-3xl mb-1.5 leading-tight">
          Choose one action <em className="text-gold2">for today.</em>
        </h2>
        <p className="text-base text-mist mb-4">No prescription. This is entirely yours.</p>

        <div className="mb-5">
          {NEXT_STEPS.slice(0, 4).map((step, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full text-left flex items-start gap-2 rounded-xl px-3.5 py-3 mb-2 text-[14px] leading-relaxed cursor-pointer transition-all ${
                selected === i ? 'text-gold2' : 'text-sand'
              }`}
              style={{
                border: selected === i ? '1px solid rgba(201,168,76,.45)' : '1px solid rgba(201,168,76,.1)',
                background: selected === i ? 'rgba(201,168,76,.06)' : 'transparent',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                style={{ background: selected === i ? 'var(--gold)' : 'rgba(201,168,76,.25)' }}
              />
              {step}
            </button>
          ))}

          {/* Custom field */}
          <div
            className="rounded-xl px-3.5 py-3 mb-2"
            style={{ border: '1px dashed rgba(201,168,76,.15)' }}
          >
            <div className="flex items-start gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: 'rgba(245,237,216,.07)' }}
              />
              <input
                type="text"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="Write your own — what would actually feel right?"
                className="w-full bg-transparent text-[14px] text-mist placeholder:text-mist/40 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleDone}
            disabled={done}
            className="btn-outline text-sm disabled:opacity-50"
          >
            Save session
          </button>
          <button
            onClick={handleDone}
            disabled={done}
            className="btn-primary disabled:opacity-50"
          >
            {done ? 'Saving…' : "I'm done for now"}
          </button>
        </div>

        {/* Upgrade nudge — shown when free user has used 2 or more sessions this month */}
        {subStatus && subStatus.planTier === 'free' && subStatus.authenticated &&
          (subStatus.sessionsThisMonth ?? 0) >= FREE_SESSIONS_PER_MONTH - 1 && (
          <div
            className="mt-5 rounded-xl p-4"
            style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.15)' }}
          >
            <div className="text-[12px] tracking-[.13em] uppercase text-gold mb-1.5">Upgrade</div>
            <p className="text-base text-sand leading-relaxed mb-3">
              {(subStatus.sessionsThisMonth ?? 0) >= FREE_SESSIONS_PER_MONTH
                ? "You've used all your free sessions this month."
                : "You have 1 free session left this month."}
              {' '}Unlimited sessions from $9.99/month.
            </p>
            <Link href="/pricing" className="btn-primary text-sm py-2 px-4 inline-block">
              See plans →
            </Link>
          </div>
        )}

        {/* Unauthenticated nudge — shown after completing a session without an account */}
        {subStatus && !subStatus.authenticated && (
          <div
            className="mt-5 rounded-xl p-4"
            style={{ background: 'rgba(15,30,46,.7)', border: '1px solid rgba(245,237,216,.06)' }}
          >
            <div className="text-[12px] tracking-[.13em] uppercase text-mist mb-1.5">Save your sessions</div>
            <p className="text-base text-mist leading-relaxed mb-3">
              Create a free account to save this session and access 3 sessions per month.
            </p>
            <Link href="/auth/signin" className="btn-outline text-sm py-2 px-4 inline-block">
              Create free account →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
