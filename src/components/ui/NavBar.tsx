'use client'

import { Logo } from './Logo'

interface NavBarProps {
  right?: React.ReactNode
  variant?: 'marketing' | 'session'
}

export function NavBar({ right, variant = 'session' }: NavBarProps) {
  const isMarketing = variant === 'marketing'
  return (
    <nav
      style={{
        height: isMarketing ? '64px' : '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMarketing ? '0 28px' : '0 24px',
        background: 'rgba(8,17,28,.98)',
        borderBottom: '1px solid rgba(245,237,216,.06)',
      }}
    >
      <Logo size={isMarketing ? 'md' : 'sm'} />
      {right && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--mist)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {right}
        </div>
      )}
    </nav>
  )
}
