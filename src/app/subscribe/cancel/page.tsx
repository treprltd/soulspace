'use client'

import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

export default function SubscribeCancel() {
  const router = useRouter()

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#060E18' }}
    >
      <div className="animate-fade-in max-w-sm w-full">
        <Logo size="md" />
        <div className="w-8 h-px mx-auto mt-5 mb-8" style={{ background: 'rgba(201,168,76,.2)' }} />

        <h1 className="font-serif font-light text-sand2 text-2xl mb-3 leading-tight">
          No problem.<br />
          <em className="text-gold2">Come back when ready.</em>
        </h1>
        <p className="text-xs text-mist leading-relaxed mb-7">
          Your free sessions are still available.<br />
          Upgrade whenever it feels right.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => router.push('/pricing')}
            className="btn-outline text-xs py-2.5"
          >
            View plans →
          </button>
          <button
            onClick={() => router.push('/age-gate')}
            className="btn-primary text-xs py-2.5"
          >
            Start a free session →
          </button>
        </div>
      </div>
    </main>
  )
}
