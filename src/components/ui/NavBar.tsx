'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from './Logo'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface NavBarProps {
  /** Optional page-context label shown only during session flow */
  right?: React.ReactNode
}

export function NavBar({ right }: NavBarProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMenuOpen(false)
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const emailInitial = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <nav
      className="h-12 flex items-center justify-between px-6"
      style={{ background: 'rgba(8,17,28,.98)', borderBottom: '1px solid rgba(245,237,216,.04)' }}
    >
      <Logo size="sm" />

      <div className="flex items-center gap-3">

        {/* Loading — show nothing to prevent flash */}
        {user === undefined ? null : user ? (

          /* ── Authenticated: avatar + dropdown ── */
          <div className="flex items-center gap-3">
          {right && (
            <div className="text-[18px]" style={{ color: 'rgba(213,226,235,.72)' }}>{right}</div>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[17px] leading-none font-medium transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(201,168,76,.15)',
                border: '1px solid rgba(201,168,76,.3)',
                color: 'var(--gold2)',
              }}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {emailInitial}
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-9 w-52 rounded-xl py-1.5 z-50 animate-fade-in"
                style={{
                  background: 'rgba(10,22,35,.98)',
                  border: '1px solid rgba(245,237,216,.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                }}
              >
                <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(245,237,216,.05)' }}>
                  <div className="text-[17px] text-mist truncate">{user.email}</div>
                </div>
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[19px] text-sand hover:text-sand2 transition-colors">
                  Dashboard
                </Link>
                <Link href="/settings" onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[19px] text-sand hover:text-sand2 transition-colors">
                  Account &amp; settings
                </Link>
                <Link href="/age-gate" onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[19px] text-sand hover:text-sand2 transition-colors">
                  Begin a session
                </Link>
                <Link href="/contact" onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[19px] text-sand hover:text-sand2 transition-colors">
                  Contact
                </Link>
                <div style={{ borderTop: '1px solid rgba(245,237,216,.05)', margin: '4px 0' }} />
                <button onClick={handleSignOut}
                  className="w-full text-left flex items-center px-3.5 py-2.5 text-[19px] hover:opacity-80 transition-opacity"
                  style={{ color: 'rgba(212,64,64,.75)' }}>
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>

        ) : (

          /* ── Not authenticated ── */
          <div className="flex items-center gap-2">
            {/* Page context label (shown only during session flow) */}
            {right && <div className="text-[18px] text-mist mr-1">{right}</div>}

            {/* Always-visible sign-in button */}
            <Link
              href="/auth/signin"
              className="text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
              style={{
                border: '1px solid rgba(201,168,76,.35)',
                color: 'var(--gold2)',
                background: 'rgba(201,168,76,.06)',
              }}
            >
              Sign in
            </Link>
          </div>

        )}
      </div>
    </nav>
  )
}
