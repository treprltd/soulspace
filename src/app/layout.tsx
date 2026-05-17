import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'

// Self-hosted via next/font — eliminates the render-blocking Google Fonts
// network request on every page load (biggest mobile perf win).
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

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
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
