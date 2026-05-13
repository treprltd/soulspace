import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function Under13() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm text-center animate-fade-in">
        <Logo size="md" />
        <div className="w-8 h-px mx-auto mt-4 mb-5" style={{ background: 'rgba(201,168,76,.2)' }} />
        <h1 className="font-serif font-light text-sand2 text-xl mb-3">
          Soul Space is for ages 13 and older.
        </h1>
        <p className="text-sm text-mist leading-relaxed mb-8">
          We hope you find the support you need from a trusted adult in your life.
        </p>
        <Link href="/" className="text-xs text-mist underline underline-offset-4">
          Return home
        </Link>
      </div>
    </main>
  )
}
