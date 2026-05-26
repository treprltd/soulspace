'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { Suspense } from 'react'
import { type AdminEnv, getDefaultAdminEnv } from '@/lib/admin/env'

const ENV_META: Record<AdminEnv, { label: string; color: string; bg: string }> = {
  dev:  { label: 'Dev',  color: '#3DAF96', bg: 'rgba(42,140,122,.18)' },
  qa:   { label: 'QA',   color: '#C9A84C', bg: 'rgba(201,168,76,.18)' },
  prod: { label: 'Prod', color: '#D44040', bg: 'rgba(212,64,64,.18)'  },
}

const NAV_LINKS = [
  { href: '/admin',             label: 'Dashboard',      icon: '◈' },
  { href: '/admin/analytics',   label: 'Analytics',      icon: '◉' },
  { href: '/admin/retention',   label: 'Retention',      icon: '⟳' },
  { href: '/admin/revenue',     label: 'Revenue',        icon: '◇' },
  { href: '/admin/mirror',      label: 'Mirror Quality', icon: '◎' },
  { href: '/admin/feedback',    label: 'Feedback',       icon: '★' },
  { href: '/admin/sessions',    label: 'Sessions',       icon: '⊟' },
  { href: '/admin/safety',      label: 'Safety',         icon: '⚑' },
  { href: '/admin/users',       label: 'Users',          icon: '⊕' },
  { href: '/admin/events',      label: 'Events',         icon: '≡' },
  { href: '/admin/health',      label: 'System Health',  icon: '◉' },
]

function EnvBadge({ env }: { env: AdminEnv }) {
  const meta = ENV_META[env]
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.10em',
      textTransform: 'uppercase', padding: '3px 9px', borderRadius: '4px',
      color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`,
    }}>
      {meta.label}
    </span>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentEnv = (searchParams.get('env') ?? getDefaultAdminEnv()) as AdminEnv

  function switchEnv(env: AdminEnv) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('env', env)
    router.push(`${pathname}?${p.toString()}`)
  }

  async function signOut() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0, background: 'var(--ink)',
        borderRight: '1px solid var(--hairline)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <Logo size="sm" />
          <div style={{
            marginTop: '4px', fontSize: '10px', letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.6,
          }}>
            Admin Panel
          </div>
        </div>

        {/* Env switcher */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '8px' }}>
            Environment
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(Object.keys(ENV_META) as AdminEnv[]).map(env => {
              const meta = ENV_META[env]
              const active = env === currentEnv
              return (
                <button
                  key={env}
                  onClick={() => switchEnv(env)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 10px', borderRadius: 'var(--r-md)',
                    border: active ? `1px solid ${meta.color}50` : '1px solid transparent',
                    background: active ? meta.bg : 'transparent',
                    color: active ? meta.color : 'var(--mist)',
                    fontSize: '13px', fontFamily: 'var(--font-sans)',
                    fontWeight: active ? 600 : 400, cursor: 'pointer',
                    textAlign: 'left', transition: 'all .12s',
                  }}
                >
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: active ? meta.color : 'rgba(139,167,184,.3)',
                    flexShrink: 0,
                  }} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '10px 10px' }}>
          {NAV_LINKS.map(link => {
            const active = link.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={`${link.href}?env=${currentEnv}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: 'var(--r-md)',
                  marginBottom: '2px', textDecoration: 'none',
                  color: active ? 'var(--sand2)' : 'var(--mist)',
                  background: active ? 'rgba(245,237,216,.06)' : 'transparent',
                  fontSize: '14px', fontFamily: 'var(--font-sans)',
                  fontWeight: active ? 500 : 400, transition: 'all .12s',
                }}
              >
                <span style={{ fontSize: '16px', opacity: 0.8 }}>{link.icon}</span>
                {link.label}
                {link.label === 'Safety' && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', padding: '1px 6px',
                    borderRadius: '999px', background: 'rgba(212,64,64,.2)',
                    color: '#D44040', fontWeight: 700,
                  }} id="safety-badge" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--hairline)' }}>
          <EnvBadge env={currentEnv} />
          <button
            onClick={signOut}
            style={{
              marginTop: '10px', width: '100%', padding: '8px',
              background: 'transparent', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)', color: 'var(--mist)',
              fontSize: '12px', fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'border-color .12s',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {children}
      </div>

    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  )
}
