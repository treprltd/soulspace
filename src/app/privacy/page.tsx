import { LegalLayout } from '@/components/ui/LegalLayout'

export const metadata = {
  title: 'Privacy Policy — Soul Space',
  description: 'How Soul Space collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How Soul Space collects, uses, and protects your information."
      lastUpdated="May 2026"
      sections={[
        {
          heading: '1. Who We Are',
          body: (
            <p>
              Soul Space is operated by Soul Space Health, Inc. (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
              Soul Space is a guided emotional reflection tool — not a therapy service, mental health
              provider, or medical device. Questions about this policy can be sent to{' '}
              <a href="mailto:privacy@soulspacehealth.org" className="underline hover:opacity-80">
                privacy@soulspacehealth.org
              </a>.
            </p>
          ),
        },
        {
          heading: '2. What We Collect',
          body: (
            <div className="space-y-3">
              <p><strong className="text-sand">Account information.</strong> If you create an account, we collect your email address. We do not collect passwords — authentication is via magic link only.</p>
              <p><strong className="text-sand">Session content.</strong> If you are signed in and choose to save a session, your inputs (resonance branch, emotion tags, context text) and the Mirror reflection are encrypted with AES-256-GCM before being written to our database. We never store session content in plaintext.</p>
              <p><strong className="text-sand">Usage events.</strong> We collect anonymised interaction events (e.g. &ldquo;session started&rdquo;, &ldquo;mirror rendered&rdquo;, &ldquo;resonance tapped&rdquo;) in our own database. We do not use Google Analytics, Meta Pixel, or any third-party tracking script.</p>
              <p><strong className="text-sand">Payment information.</strong> Payments are processed by Stripe. We never see or store your card number, CVV, or banking details. Stripe provides us only with subscription status and a customer ID.</p>
              <p><strong className="text-sand">Safety events.</strong> When our AI safety classifier flags a session for potential crisis content, a safety event is logged (without the original text) so we can monitor platform safety.</p>
            </div>
          ),
        },
        {
          heading: '3. How We Use Your Information',
          body: (
            <div className="space-y-2">
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Deliver and improve the Soul Space reflection experience</li>
                <li>Send you magic-link sign-in emails and subscription confirmation emails</li>
                <li>Maintain the safety and security of the platform</li>
                <li>Understand aggregate usage patterns (using only our own analytics)</li>
                <li>Process and manage your subscription via Stripe</li>
              </ul>
              <p className="mt-3">We do not use your session content to train AI models, and we do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
            </div>
          ),
        },
        {
          heading: '4. How We Protect Your Data',
          body: (
            <div className="space-y-2">
              <p>Session content is encrypted with AES-256-GCM (a military-grade symmetric cipher) before it is stored. The encryption key is never stored alongside the ciphertext.</p>
              <p>Our database is hosted on Supabase with row-level security (RLS) enforced on every table — each user can only access their own rows.</p>
              <p>All data is transmitted over HTTPS with HSTS enforced. Our servers and database infrastructure are hosted in the United States.</p>
            </div>
          ),
        },
        {
          heading: '5. Data Retention',
          body: (
            <div className="space-y-2">
              <p>We retain your account and session data for as long as your account is active. Anonymised usage events are retained for up to 24 months for product analytics.</p>
              <p>You can delete your account and all associated session data at any time from your account settings. Deletion is permanent and processed within 30 days.</p>
            </div>
          ),
        },
        {
          heading: '6. Third-Party Service Providers',
          body: (
            <div className="space-y-1">
              <p>We share limited data with the following sub-processors in order to operate the service:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong className="text-sand">Supabase</strong> — database, authentication, and row-level security (United States)</li>
                <li><strong className="text-sand">Anthropic</strong> — AI model inference for the Mirror reflection and safety classification. Session text is sent to Anthropic&rsquo;s API for processing and is subject to <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">Anthropic&rsquo;s Privacy Policy</a>. We do not share identifying information alongside session content.</li>
                <li><strong className="text-sand">Stripe</strong> — payment processing (United States)</li>
                <li><strong className="text-sand">Brevo</strong> — transactional email delivery (France / EU)</li>
                <li><strong className="text-sand">AWS Amplify</strong> — application hosting (United States)</li>
              </ul>
            </div>
          ),
        },
        {
          heading: '7. Your Rights',
          body: (
            <div className="space-y-2">
              <p>Depending on where you live, you may have rights including:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong className="text-sand">Access.</strong> Request a copy of the personal data we hold about you.</li>
                <li><strong className="text-sand">Correction.</strong> Request correction of inaccurate data.</li>
                <li><strong className="text-sand">Deletion.</strong> Request deletion of your account and associated data.</li>
                <li><strong className="text-sand">Opt-out of sale.</strong> We do not sell personal information. If you are a California resident, this satisfies your CCPA/CPRA opt-out right.</li>
                <li><strong className="text-sand">Data portability.</strong> Request a machine-readable export of your session data.</li>
              </ul>
              <p className="mt-3">To exercise any of these rights, email <a href="mailto:privacy@soulspacehealth.org" className="underline hover:opacity-80">privacy@soulspacehealth.org</a> from the address associated with your account. We will respond within 30 days.</p>
            </div>
          ),
        },
        {
          heading: '8. Cookies',
          body: (
            <p>
              Soul Space uses only essential session cookies required for authentication and
              age-gate consent. We do not use advertising cookies, tracking pixels, or
              fingerprinting. See our{' '}
              <a href="/cookies" className="underline hover:opacity-80">Cookie Notice</a>{' '}
              for full details.
            </p>
          ),
        },
        {
          heading: '9. Children',
          body: (
            <p>
              Soul Space is not directed at children under 13. We do not knowingly collect personal
              information from anyone under 13. If you believe a child under 13 has provided us
              with personal information, please contact us at{' '}
              <a href="mailto:privacy@soulspacehealth.org" className="underline hover:opacity-80">
                privacy@soulspacehealth.org
              </a>{' '}
              and we will delete it promptly.
            </p>
          ),
        },
        {
          heading: '10. Changes to This Policy',
          body: (
            <p>
              We may update this policy from time to time. When we do, we will update the
              &ldquo;Last updated&rdquo; date at the top. If changes are material, we will notify
              signed-in users by email before they take effect.
            </p>
          ),
        },
      ]}
    />
  )
}
