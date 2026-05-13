'use client'

import Link from 'next/link'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: '16px',
  md: '22px',
  lg: '28px',
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <Link
      href="/"
      className={className}
      style={{
        fontFamily: 'var(--font-serif)',
        fontWeight: 300,
        fontSize: SIZES[size],
        color: 'var(--sand2)',
        letterSpacing: '-0.01em',
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      Soul{' '}
      <em
        style={{
          fontStyle: 'normal',
          color: 'var(--gold)',
          fontWeight: 400,
        }}
      >
        Space
      </em>
    </Link>
  )
}
