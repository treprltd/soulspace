'use client'

import Link from 'next/link'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }
  return (
    <Link
      href="/"
      className={`font-serif font-light text-sand2 no-underline ${sizes[size]} ${className}`}
      style={{ textDecoration: 'none' }}
    >
      Soul <em className="not-italic text-gold font-normal">Space</em>
    </Link>
  )
}
