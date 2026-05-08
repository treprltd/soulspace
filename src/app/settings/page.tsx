'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'

export default function Settings() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await fetch('/api/user/data', { method: 'DELETE' })
      setDeleted(true)
      setTimeout(() => router.push('/'), 1500)
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar right="Settings" />
      <div className="px-6 py-5 max-w-lg mx-auto animate-fade-in">
        <h2 className="font-serif font-light text-sand2 text-2xl mb-1.5 leading-tight">
          Your <em className="text-gold2">data.</em>
        </h2>
        <p className="text-xs text-mist mb-6">You control what is stored and when it is deleted.</p>

        {/* What is stored */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[7px] tracking-[.11em] uppercase text-mist mb-2 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Phase 1 — what is stored
          </div>
          {[
            { label: 'Session content', sub: 'Emotion tags, context text, Mirror output — encrypted' },
            { label: 'Session count', sub: 'Number and timestamps — for return measurement' },
            { label: 'Resonance tap result', sub: 'Accurate / Not quite — anonymous aggregate' },
          ].map(({ label, sub }) => (
            <div key={label} className="flex justify-between items-center py-2.5 border-b border-white/[.04] last:border-0">
              <div>
                <div className="text-sm text-sand">{label}</div>
                <div className="text-[9px] text-mist mt-0.5">{sub}</div>
              </div>
              <div
                className="w-7 h-4 rounded-full relative flex-shrink-0"
                style={{ background: 'var(--gold)' }}
              >
                <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white" />
              </div>
            </div>
          ))}
        </div>

        {/* Delete */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[7px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Delete your data
          </div>

          {deleted ? (
            <p className="text-sm text-mist text-center py-2">All data deleted. Redirecting…</p>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-2.5 text-xs rounded-lg text-center mb-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: '1px solid rgba(212,64,64,.3)', color: 'rgba(212,64,64,.75)', background: 'transparent' }}
              >
                {confirmDelete
                  ? 'Tap again to confirm — this is permanent'
                  : 'Delete all my sessions and data →'}
              </button>
              <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.35)' }}>
                Permanent. Encrypted. No recycle bin. CPRA compliant.<br />
                Full privacy dashboard ships in Phase 2.
              </p>
            </>
          )}
        </div>

        <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(139,167,184,.3)' }}>
          Phase 2 will add: toggle controls per data type, export, assessment reset, notification preferences.
        </p>
      </div>
    </main>
  )
}
