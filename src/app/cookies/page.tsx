import { LegalLayout } from '@/components/ui/LegalLayout'

export const metadata = {
  title: 'Cookie Notice — Soul Space',
  description: 'How Soul Space uses cookies and similar technologies.',
}

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Notice"
      subtitle="Soul Space uses only the cookies it needs to function. Nothing more."
      lastUpdated="May 2026"
      sections={[
        {
          heading: 'Our approach to cookies',
          body: (
            <p>
              Soul Space does not use advertising cookies, cross-site tracking pixels, or
              third-party analytics scripts. The cookies we set are strictly necessary for
              the service to work. We do not use them to build profiles, serve ads, or share
              data with data brokers.
            </p>
          ),
        },
        {
          heading: 'Cookies we set',
          body: (
            <div className="space-y-5">
              <div>
                <p className="text-sand font-medium mb-1">Authentication session (sb-*)</p>
                <p>Set by Supabase when you sign in via magic link. Stores your encrypted
                  session token so you stay signed in between page loads. Expires when you
                  sign out or after 7 days of inactivity. Without this cookie, sign-in
                  cannot work.</p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(139,167,184,.45)' }}>
                  Type: Strictly necessary · Duration: Session / 7 days · Party: First-party
                </p>
              </div>

              <div>
                <p className="text-sand font-medium mb-1">Admin session (admin_session)</p>
                <p>Set only when an administrator signs in to the admin panel. Contains the
                  admin authentication token. Never set for regular users.</p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(139,167,184,.45)' }}>
                  Type: Strictly necessary · Duration: Session · Party: First-party
                </p>
              </div>

              <div>
                <p className="text-sand font-medium mb-1">Age gate consent (ss_age_ok)</p>
                <p>Set when you confirm you are 13 or older on the age gate screen. Stores
                  your consent so you are not asked again on the same device. Does not
                  contain any personal information.</p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(139,167,184,.45)' }}>
                  Type: Strictly necessary · Duration: 1 year · Party: First-party
                </p>
              </div>
            </div>
          ),
        },
        {
          heading: 'What we do not use',
          body: (
            <ul className="list-disc list-inside space-y-1">
              <li>Google Analytics or any third-party analytics</li>
              <li>Meta Pixel, TikTok Pixel, or any advertising network pixel</li>
              <li>Cross-site tracking cookies</li>
              <li>Browser fingerprinting</li>
              <li>LocalStorage or IndexedDB for tracking purposes</li>
            </ul>
          ),
        },
        {
          heading: 'Third-party scripts',
          body: (
            <div className="space-y-2">
              <p>
                The only third-party JavaScript loaded on Soul Space pages is{' '}
                <strong className="text-sand">Stripe.js</strong> on checkout pages.
                Stripe uses this to securely collect payment card data in an isolated
                iframe. Stripe&rsquo;s cookie usage is governed by{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
                  Stripe&rsquo;s Privacy Policy
                </a>.
              </p>
              <p>
                Stripe.js is loaded only on the pricing and checkout pages, not on
                session or reflection pages.
              </p>
            </div>
          ),
        },
        {
          heading: 'Managing cookies',
          body: (
            <div className="space-y-2">
              <p>
                Because we only use strictly necessary cookies, blocking them will prevent
                the service from working correctly — you will not be able to sign in or
                save sessions.
              </p>
              <p>
                You can clear cookies for soulspacehealth.org at any time through your
                browser settings. This will sign you out and reset your age gate consent.
              </p>
            </div>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about our use of cookies can be sent to{' '}
              <a href="mailto:privacy@soulspacehealth.org" className="underline hover:opacity-80">
                privacy@soulspacehealth.org
              </a>.
            </p>
          ),
        },
      ]}
    />
  )
}
