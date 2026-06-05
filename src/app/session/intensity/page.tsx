'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/session/ProgressBar'

export default function Intensity() {
  const router = useRouter()
  const [intensity, setIntensity] = useState(5)

  const handleContinue = () => {
    sessionStorage.setItem('ss_intensity', String(intensity))
    router.push('/session/context')
  }

  const fillPercent = ((intensity - 1) / 9) * 100

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right={<span style={{ color: 'rgba(139,167,184,.45)', fontSize: '11px' }}>Your session</span>} />
      <div className="session-outer-pad px-6 py-5 max-w-xl mx-auto animate-fade-in">
        <ProgressBar step={2} total={3} />

        <h2 className="font-serif font-light text-sand2 text-2xl mb-6 leading-tight">
          How <em className="text-gold2">heavy</em> does this feel right now?
        </h2>

        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.06)' }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-mist">Weight</span>
            <span className="font-serif text-gold2 text-xl">{intensity} / 10</span>
          </div>

          <div
            className="relative h-0.5 rounded-sm mb-1.5"
            style={{ background: 'rgba(245,237,216,.07)' }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-sm"
              style={{
                width: `${fillPercent}%`,
                background: 'linear-gradient(90deg, rgba(201,168,76,.4), var(--gold))',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full"
              style={{
                left: `${fillPercent}%`,
                background: 'var(--gold)',
                boxShadow: '0 0 8px rgba(201,168,76,.4)',
              }}
            />
            <input
              type="range"
              min={1}
              max={10}
              value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-4 -top-1.5"
            />
          </div>

          <div className="flex justify-between text-[9px] mt-1.5">
            <span className="text-mist">Barely there</span>
            {/* Hide mid-label on narrow phones — it collides with the outer labels */}
            <span className="text-gold2 italic hidden sm:inline">Hard to think clearly</span>
            <span className="text-mist">Overwhelming</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-outline text-xs px-5 flex-shrink-0">← Back</button>
          <button onClick={handleContinue} className="btn-primary flex-1">Continue →</button>
        </div>
      </div>
    </main>
  )
}
