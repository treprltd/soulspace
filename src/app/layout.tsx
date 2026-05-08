import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Soul Space — The pause before the decision that changes things.',
  description: 'A quiet place to understand yourself before you decide. Non-clinical. Non-diagnostic. The structured pause between emotional overload and consequential action.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://soulspacehealth.org'),
  openGraph: {
    title: 'Soul Space',
    description: 'The structured pause between emotional overload and consequential action.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
