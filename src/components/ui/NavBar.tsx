'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from './Logo'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface NavBarProps {
  right?: React.ReactNode
}

export function NavBar({ right }: NavBarProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = loading
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    // Get initial auth state
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null))

    // Keep in sync with auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
        {/* user === undefined means we're still loading — show nothing to prevent flash */}
        {user === undefined ? null : user ? (
          /* ── Authenticated: avatar + dropdown ── */
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium transition-opacity hover:opacity-80"
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
                {/* Email label */}
                <div
                  className="px-3.5 py-2.5"
                  style={{ borderBottom: '1px solid rgba(245,237,216,.05)' }}
                >
                  <div className="text-[9px] text-mist truncate">{user.email}</div>
                </div>

                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[11px] text-sand hover:text-sand2 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[11px] text-sand hover:text-sand2 transition-colors"
                >
                  Account &amp; settings
                </Link>
                <Link
                  href="/age-gate"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 text-[11px] text-sand hover:text-sand2 transition-colors"
                >
                  Begin a session
                </Link>

                <div style={{ borderTop: '1px solid rgba(245,237,216,.05)', margin: '4px 0' }} />

                <button
                  onClick={handleSignOut}
                  className="w-full text-left flex items-center px-3.5 py-2.5 text-[11px] transition-colors hover:opacity-80"
                  style={{ color: 'rgba(212,64,64,.75)' }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Not authenticated ── */
          <>
            {right && (
              <div className="text-[9px] text-mist">{right}</div>
            )}
            {!right && (
              <Link
                href="/auth/signin"
                className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'rgba(201,168,76,.65)' }}
              >
                Sign in →
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  )
}
