'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }
  return (
    <span className={`font-serif font-light text-sand2 ${sizes[size]} ${className}`}>
      Soul <em className="not-italic text-gold font-normal">Space</em>
    </span>
  )
}
