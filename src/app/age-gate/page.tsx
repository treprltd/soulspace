'use client'

import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

export default function AgeGate() {
  const router = useRouter()

  const handleUnder13 = () => {
    // No data stored. Redirect to gentle block page.
    router.push('/age-gate/under-13')
  }

  const handleTeen = () => {
    // AADC compliant — no data stored from this screen.
    // Teen-safe session flow (no difference in Phase 1, but flagged for Phase 4).
    router.push('/start?age=teen')
  }

  const handleAdult = () => {
    router.push('/start')
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: '#060E18' }}
    >
      <div className="w-full max-w-sm text-center animate-fade-in">
        <Logo size="lg" />
        <div className="w-8 h-px mx-auto mt-4 mb-5" style={{ background: 'rgba(201,168,76,.2)' }} />

        <p className="text-[8px] tracking-[.2em] uppercase text-mist mb-4">Before you enter</p>
        <h1 className="font-serif font-light text-sand2 text-2xl mb-2">How old are you?</h1>
        <p className="text-xs text-mist mb-7 leading-relaxed">
          Soul Space is designed for people 13 and older.<br />We don&apos;t store your answer.
        </p>

        <div className="flex flex-col gap-2.5 mb-6">
          <button
            onClick={handleUnder13}
            className="py-3.5 px-5 rounded-xl text-[13px] font-serif italic cursor-pointer transition-opacity hover:opacity-80"
            style={{
              border: '1px solid rgba(212,64,64,.18)',
              color: 'rgba(212,64,64,.6)',
              background: 'transparent',
            }}
          >
            Under 13
          </button>

          <button
            onClick={handleTeen}
            className="py-3.5 px-5 rounded-xl text-[13px] cursor-pointer transition-opacity hover:opacity-80"
            style={{
              border: '1px solid rgba(124,58,237,.2)',
              color: '#a78bfa',
              background: 'transparent',
            }}
          >
            <span className="font-serif italic">Ages 13–17</span>
            <div className="text-[9px] mt-0.5" style={{ color: 'rgba(167,139,250,.5)' }}>
              Teen-safe experience · AADC compliant
            </div>
          </button>

          <button
            onClick={handleAdult}
            className="py-3.5 px-5 rounded-xl text-[13px] font-serif italic cursor-pointer transition-opacity hover:opacity-80"
            style={{
              border: '1px solid rgba(201,168,76,.22)',
              color: 'var(--gold2)',
              background: 'rgba(201,168,76,.04)',
            }}
          >
            18 or older →
          </button>
        </div>

        <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
          No data collected or stored from this screen.<br />
          CPRA · AADC · COPPA compliant
        </p>
      </div>
    </main>
  )
}
