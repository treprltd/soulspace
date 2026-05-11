// Brevo (formerly Sendinblue) transactional email utility
// Used for: subscription confirmations, account notifications
// Auth magic links go through Supabase's custom SMTP (configured in Supabase dashboard)

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const FROM_EMAIL = 'noreply@soulspacehealth.org'
const FROM_NAME = 'Soul Space'

interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  htmlContent: string
  textContent?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: opts.to, name: opts.toName ?? opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
      textContent: opts.textContent,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo send failed: ${res.status} ${err}`)
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

export function subscriptionConfirmationEmail(planName: string): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: `You're on Soul Space ${planName}`,
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#060E18;color:#FAF7F0;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:300;color:#E8C97A;margin-bottom:8px;">
      Soul Space
    </div>
    <div style="width:32px;height:1px;background:rgba(201,168,76,.3);margin-bottom:32px;"></div>

    <h1 style="font-family:Georgia,serif;font-weight:300;font-size:24px;color:#FAF7F0;margin:0 0 12px;">
      Welcome to <em style="color:#E8C97A;">${planName}.</em>
    </h1>
    <p style="font-size:14px;color:#8BA7B8;line-height:1.7;margin:0 0 24px;">
      Your subscription is active. Unlimited sessions are now available whenever you need them.
    </p>
    <p style="font-size:14px;color:#8BA7B8;line-height:1.7;margin:0 0 32px;">
      Everything you share remains encrypted and private — that hasn't changed.
    </p>

    <a href="https://soulspacehealth.org/age-gate"
       style="display:inline-block;background:#C9A84C;color:#08111C;font-size:14px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none;">
      Begin a session →
    </a>

    <div style="margin-top:40px;padding-top:24px;border-top:1px solid rgba(245,237,216,.06);">
      <p style="font-size:10px;color:rgba(139,167,184,.4);line-height:1.6;margin:0;">
        Manage or cancel your subscription any time from your
        <a href="https://soulspacehealth.org/settings" style="color:rgba(139,167,184,.6);">account settings</a>.<br>
        Soul Space · Non-clinical · Non-diagnostic · Not a crisis service
      </p>
    </div>
  </div>
</body>
</html>`,
    textContent: `Welcome to Soul Space ${planName}.\n\nYour subscription is active. Unlimited sessions are now available.\n\nBegin a session: https://soulspacehealth.org/age-gate\n\nManage your subscription: https://soulspacehealth.org/settings`,
  }
}
