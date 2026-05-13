'use client'

import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

export default function Welcome() {
  const router = useRouter()

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg text-center animate-fade-in">
        {/* Pre-session affirmation — not one of the 5 session moments */}
        <div className="affirm-copy mb-6">
          Whatever brought you here —<br />you do not need to have it figured out yet.
        </div>

        <h1 className="font-serif font-light text-sand2 leading-tight mb-3" style={{ fontSize: '26px' }}>
          A quiet place to understand yourself<br />
          <em className="text-gold2">before you decide.</em>
        </h1>

        <p className="text-xs text-mist mb-8 leading-loose">
          Not therapy. Not meditation. Not a budgeting app.<br />
          The pause before the decision that changes things.
        </p>

        <div className="w-6 h-px mx-auto mb-6" style={{ background: 'rgba(201,168,76,.2)' }} />

        <div
          className="text-left rounded-xl p-4 mb-6"
          style={{ background: 'rgba(15,30,46,.7)' }}
        >
          <div className="scope-row">
            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--teal2)', width: '16px' }}>✓</span>
            <span className="text-[11px] leading-relaxed" style={{ color: 'var(--teal2)' }}>
              Recognise emotional patterns before important decisions
            </span>
          </div>
          <div className="scope-row">
            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--teal2)', width: '16px' }}>✓</span>
            <span className="text-[11px] leading-relaxed" style={{ color: 'var(--teal2)' }}>
              Seasonal emotional language — clinically reviewed, non-diagnostic
            </span>
          </div>
          <div className="scope-row">
            <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(212,64,64,.6)', width: '16px' }}>✕</span>
            <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(212,64,64,.6)' }}>
              Not a crisis service — call 988 if you are in immediate danger
            </span>
          </div>
          <div className="scope-row">
            <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(212,64,64,.6)', width: '16px' }}>✕</span>
            <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(212,64,64,.6)' }}>
              Not diagnostic — no clinical conclusions, no treatment plans
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push('/session')}
          className="btn-primary w-full py-3.5 text-[13px]"
        >
          Begin →
        </button>
      </div>
    </main>
  )
}
