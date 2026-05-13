import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function AuthError() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <Logo size="md" />
        <p className="text-base text-mist mt-6 mb-4">There was a problem signing you in. Your link may have expired.</p>
        <Link href="/" className="btn-outline text-sm">Return home</Link>
      </div>
    </main>
  )
}
