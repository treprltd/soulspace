'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

export default function AdminLogin() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') ?? '/admin'

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push(from)
      } else {
        const { error: msg } = await res.json()
        setError(msg ?? 'Invalid password')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Logo size="lg" />
          <div style={{
            marginTop: '8px', fontSize: 'var(--fs-xs)', letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.7,
          }}>
            Admin Panel
          </div>
        </div>

        <div style={{
          background: 'var(--ink2)', border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-xl)', padding: '28px',
        }}>
          <form onSubmit={handleSubmit}>
            <label style={{
              display: 'block', fontSize: 'var(--fs-3xs)', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '8px',
            }}>
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="Enter admin secret"
              style={{
                width: '100%', padding: '12px 14px', fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--font-sans)', color: 'var(--sand)',
                background: 'rgba(245,237,216,.04)', border: '1px solid rgba(245,237,216,.14)',
                borderRadius: 'var(--r-md)', outline: 'none', boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            />

            {error && (
              <p style={{
                fontSize: 'var(--fs-3xs)', color: 'var(--danger)',
                marginBottom: '12px', lineHeight: 1.5,
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary"
              style={{ width: '100%', opacity: loading || !password ? 0.6 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '16px',
          fontSize: 'var(--fs-3xs)', color: 'var(--mist-35)',
        }}>
          Set <code style={{ fontFamily: 'monospace' }}>ADMIN_SECRET</code> in your environment to enable access.
        </p>
      </div>
    </main>
  )
}
