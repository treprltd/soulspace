'use client'

import { Logo } from './Logo'

interface NavBarProps {
  right?: React.ReactNode
}

export function NavBar({ right }: NavBarProps) {
  return (
    <nav
      className="h-12 flex items-center justify-between px-6"
      style={{ background: 'rgba(8,17,28,.98)', borderBottom: '1px solid rgba(245,237,216,.04)' }}
    >
      <Logo size="sm" />
      {right && <div className="text-[9px] text-mist">{right}</div>}
    </nav>
  )
}
