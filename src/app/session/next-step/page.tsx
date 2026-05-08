'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'

const NEXT_STEPS = [
  'Write down the two things that are in tension, side by side, without trying to resolve them yet.',
  'Give yourself permission to not decide anything today — just for the next 24 hours.',
  'Talk to one person you trust — not to get advice, just to say it out loud.',
  'Take a 10-minute walk without your phone. Notice what rises up when you're quiet.',
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

export default function NextStep() {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [done, setDone] = useState(false)

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
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right="Your next step" />
      <div className="px-6 py-5 max-w-xl mx-auto animate-fade-in">
        {/* AFFIRMATION MOMENT 5 — frozen copy */}
        <div className="affirm-copy mb-3">
          You do not need to resolve anything today.<br />
          One small thing is enough.
        </div>

        <h2 className="font-serif font-light text-sand2 text-2xl mb-1.5 leading-tight">
          Choose one action <em className="text-gold2">for today.</em>
        </h2>
        <p className="text-xs text-mist mb-4">No prescription. This is entirely yours.</p>

        <div className="mb-5">
          {NEXT_STEPS.slice(0, 4).map((step, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full text-left flex items-start gap-2 rounded-xl px-3.5 py-3 mb-2 text-[11px] leading-relaxed cursor-pointer transition-all ${
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
                className="w-full bg-transparent text-[11px] text-mist placeholder:text-mist/40 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleDone}
            disabled={done}
            className="btn-outline text-xs disabled:opacity-50"
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

        <p className="text-[9px] mt-4 leading-relaxed" style={{ color: 'rgba(139,167,184,.3)' }}>
          Session saved. Session count tracked for 7-day return measurement.<br />
          No subscription prompt in Phase 1.
        </p>
      </div>
    </main>
  )
}
