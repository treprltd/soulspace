// Brevo (formerly Sendinblue) transactional email utility
// Used for: subscription confirmations, account notifications
// Auth magic links go through Supabase's custom SMTP (configured in Supabase dashboard)

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const FROM_EMAIL = 'noreply@soulspacehealth.org'
const FROM_NAME = 'Soul Space'
const APP_URL = 'https://soulspacehealth.org'

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

// ── Shared email shell ─────────────────────────────────────────────────────────
// Wraps content in the Soul Space dark-branded shell used by all transactional emails.
function emailShell(body: string, footerNote?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#060E18;color:#FAF7F0;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:300;color:#E8C97A;margin-bottom:6px;">
      Soul Space
    </div>
    <div style="width:32px;height:1px;background:rgba(201,168,76,.3);margin-bottom:36px;"></div>

    ${body}

    <!-- Footer -->
    <div style="margin-top:44px;padding-top:24px;border-top:1px solid rgba(245,237,216,.06);">
      <p style="font-size:10px;color:rgba(139,167,184,.35);line-height:1.7;margin:0;">
        ${footerNote ?? ''}
        Soul Space · Non-clinical · Non-diagnostic · Not a crisis service<br>
        <a href="${APP_URL}/settings" style="color:rgba(139,167,184,.45);">Account settings</a> ·
        <a href="${APP_URL}/privacy" style="color:rgba(139,167,184,.45);">Privacy</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

function btn(label: string, href: string, color = '#C9A84C', textColor = '#08111C'): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:${textColor};
    font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;
    margin-top:8px;">${label}</a>`
}

function heading(text: string): string {
  return `<h1 style="font-family:Georgia,serif;font-weight:300;font-size:24px;color:#FAF7F0;margin:0 0 14px;line-height:1.3;">${text}</h1>`
}

function para(text: string): string {
  return `<p style="font-size:14px;color:#8BA7B8;line-height:1.75;margin:0 0 16px;">${text}</p>`
}

function alertBox(text: string, color = '#C9A84C'): string {
  return `<div style="border-left:3px solid ${color};padding:12px 16px;margin:20px 0;
    background:rgba(245,237,216,.03);border-radius:0 6px 6px 0;">
    <p style="font-size:13px;color:${color};margin:0;line-height:1.6;">${text}</p>
  </div>`
}

// ── Email templates ────────────────────────────────────────────────────────────

/** Sent when a user signs in for the very first time (new account created). */
export function welcomeEmail(): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'Welcome to Soul Space',
    htmlContent: emailShell(`
      ${heading('You found a quiet place.')}
      ${para('Soul Space is the structured pause between what you feel and what you decide to do about it. Not therapy. Not journaling. Just a moment to stop, acknowledge what\'s here, and move forward with a little more clarity.')}
      ${para('Each session takes 5–10 minutes. You pick what feels closest. The Mirror reflects it back without judgment.')}
      ${alertBox('Everything you share is end-to-end encrypted. We can\'t read it — and we never try.')}
      ${btn('Begin your first session →', `${APP_URL}/age-gate`)}
    `, 'You received this because you created a Soul Space account.<br>'),
    textContent: `Welcome to Soul Space.\n\nSoul Space is the structured pause between what you feel and what you decide to do about it. Not therapy. Not journaling.\n\nEach session takes 5–10 minutes. Everything you share is encrypted.\n\nBegin your first session: ${APP_URL}/age-gate`,
  }
}

/** Sent when checkout.session.completed fires — subscription now active. */
export function subscriptionConfirmationEmail(planName: string): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: `You're on Soul Space ${planName}`,
    htmlContent: emailShell(`
      ${heading(`Welcome to <em style="color:#E8C97A;">${planName}.</em>`)}
      ${para('Your subscription is active. Unlimited sessions are now available whenever you need them.')}
      ${para('Everything you share remains encrypted and private — that hasn\'t changed.')}
      ${btn('Begin a session →', `${APP_URL}/age-gate`)}
    `, 'Manage or cancel any time from your account settings.<br>'),
    textContent: `Welcome to Soul Space ${planName}.\n\nYour subscription is active. Unlimited sessions are now available.\n\nBegin a session: ${APP_URL}/age-gate\n\nManage your subscription: ${APP_URL}/settings`,
  }
}

/** Sent when cancel_at_period_end becomes true — subscription cancellation scheduled. */
export function subscriptionCancellationEmail(planName: string, periodEnd: string): { subject: string; htmlContent: string; textContent: string } {
  const endDate = new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return {
    subject: 'Your Soul Space subscription has been cancelled',
    htmlContent: emailShell(`
      ${heading('Cancellation confirmed.')}
      ${para(`Your <strong style="color:#FAF7F0;">${planName}</strong> subscription has been cancelled.`)}
      ${para(`You'll keep full access until <strong style="color:#FAF7F0;">${endDate}</strong>. After that, your account moves to the free plan — your session history stays with you.`)}
      ${alertBox('Changed your mind? You can resubscribe any time from your account settings before the end date.', '#3DAF96')}
      ${btn('View account settings', `${APP_URL}/settings`)}
    `, 'We\'re sorry to see you go.<br>'),
    textContent: `Your Soul Space ${planName} subscription has been cancelled.\n\nYou keep full access until ${endDate}. After that, your account moves to the free plan.\n\nChanged your mind? Resubscribe any time: ${APP_URL}/settings`,
  }
}

/** Sent when customer.subscription.deleted fires — access now ended. */
export function subscriptionExpiredEmail(): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'Your Soul Space subscription has ended',
    htmlContent: emailShell(`
      ${heading('Your subscription has ended.')}
      ${para('Your paid access to Soul Space has ended. Your account is now on the free plan.')}
      ${para('Your session history is still here. The free plan gives you a limited number of sessions per month — more than enough to come back whenever you need to.')}
      ${btn('Resubscribe →', `${APP_URL}/pricing`)}
    `, ''),
    textContent: `Your Soul Space subscription has ended. Your account is now on the free plan.\n\nYour session history is still here.\n\nResubscribe: ${APP_URL}/pricing`,
  }
}

/** Sent when invoice.payment_failed fires. */
export function paymentFailedEmail(planName: string, retryDate?: string): { subject: string; htmlContent: string; textContent: string } {
  const retryText = retryDate
    ? `Stripe will automatically retry your payment on <strong style="color:#FAF7F0;">${new Date(retryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</strong>.`
    : 'Stripe will automatically retry your payment in the next few days.'
  return {
    subject: 'Payment failed — action needed',
    htmlContent: emailShell(`
      ${heading('We couldn\'t process your payment.')}
      ${alertBox('Your Soul Space payment failed. Please update your payment method to keep your access.', '#D44040')}
      ${para(`You\'re currently on <strong style="color:#FAF7F0;">${planName}</strong>. ${retryText}`)}
      ${para('If payment continues to fail, your account will be moved to the free plan.')}
      ${btn('Update payment method →', `${APP_URL}/settings`, '#D44040', '#FFFFFF')}
    `, ''),
    textContent: `Your Soul Space payment failed.\n\nPlease update your payment method to keep your ${planName} access.\n\nUpdate payment: ${APP_URL}/settings`,
  }
}

/** Sent when invoice.payment_succeeded after a previous failure. */
export function paymentRecoveredEmail(planName: string): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'Payment successful — you\'re all set',
    htmlContent: emailShell(`
      ${heading('Payment successful.')}
      ${para(`Your <strong style="color:#FAF7F0;">${planName}</strong> subscription is active again. No further action needed.`)}
      ${btn('Begin a session →', `${APP_URL}/age-gate`)}
    `, ''),
    textContent: `Your Soul Space ${planName} subscription is active again.\n\nBegin a session: ${APP_URL}/age-gate`,
  }
}

/** Sent immediately before the user's data is deleted. */
export function accountDeletionEmail(): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'Your Soul Space account has been deleted',
    htmlContent: emailShell(`
      ${heading('Account deleted.')}
      ${para('Your Soul Space account and all associated session data have been permanently deleted.')}
      ${para('This includes your session history, emotions data, and any reflections. Nothing is retained on our servers.')}
      ${para('If you\'d like to return, you can create a new account any time — no trace of the old one will remain.')}
    `, 'This action was requested from your account settings.<br>'),
    textContent: 'Your Soul Space account and all session data have been permanently deleted.\n\nNothing is retained. You can create a new account any time: ' + APP_URL,
  }
}

/** Sent to inactive users who haven't had a session in 7+ days. */
export function reEngagementEmail(daysSinceLastSession: number): { subject: string; htmlContent: string; textContent: string } {
  const subjects = [
    'It\'s been a little while.',
    'Whenever you\'re ready.',
    'The pause is still here.',
    'Something worth coming back to.',
  ]
  const subject = subjects[Math.floor(daysSinceLastSession / 7) % subjects.length]
  return {
    subject,
    htmlContent: emailShell(`
      ${heading('You don\'t need to have it figured out.')}
      ${para(`It\'s been ${daysSinceLastSession} days since your last session. That\'s fine — Soul Space isn\'t something you need to use every day.`)}
      ${para('But if something\'s been sitting with you, this is a quiet place to put it down for a moment.')}
      ${btn('Return to Soul Space →', `${APP_URL}/age-gate`)}
    `, 'To stop receiving these emails, visit your account settings.<br>'),
    textContent: `It's been ${daysSinceLastSession} days since your last Soul Space session.\n\nWhenever you're ready: ${APP_URL}/age-gate\n\nTo unsubscribe from these emails: ${APP_URL}/settings`,
  }
}

// ── Admin alert emails ─────────────────────────────────────────────────────────

/** Sent to ADMIN_EMAIL when safety flags spike in a session. */
export function adminSafetyAlertEmail(opts: {
  sessionId: string
  flagType: string
  branch: string | null
  flagsUnreviewed: number
}): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: `⚑ Safety alert — crisis flag triggered`,
    htmlContent: emailShell(`
      ${alertBox(`A crisis safety flag was triggered in session <strong>${opts.sessionId.slice(0, 8)}</strong>.`, '#D44040')}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${[
          ['Flag type', opts.flagType || 'unspecified'],
          ['Branch', opts.branch || 'unknown'],
          ['Unreviewed flags (all time)', String(opts.flagsUnreviewed)],
        ].map(([k, v]) => `
          <tr>
            <td style="font-size:12px;color:#8BA7B8;padding:6px 0;border-bottom:1px solid rgba(245,237,216,.06);width:50%;">${k}</td>
            <td style="font-size:12px;color:#FAF7F0;padding:6px 0;border-bottom:1px solid rgba(245,237,216,.06);">${v}</td>
          </tr>`).join('')}
      </table>
      ${btn('Review in admin panel →', `${APP_URL}/admin/safety?env=prod`, '#D44040', '#FFFFFF')}
    `, ''),
    textContent: `Safety alert: crisis flag triggered.\n\nSession: ${opts.sessionId}\nFlag type: ${opts.flagType}\nBranch: ${opts.branch}\nUnreviewed: ${opts.flagsUnreviewed}\n\nReview: ${APP_URL}/admin/safety?env=prod`,
  }
}

/** Sent to ADMIN_EMAIL each morning with key overnight metrics. */
export function adminDailyDigestEmail(stats: {
  newUsers: number
  sessions24h: number
  safetyFlags24h: number
  mrr?: number
  resonanceRate?: number | null
}): { subject: string; htmlContent: string; textContent: string } {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const rows = [
    ['New users (24h)', stats.newUsers.toString()],
    ['Sessions (24h)', stats.sessions24h.toString()],
    ['Safety flags (24h)', stats.safetyFlags24h.toString(), stats.safetyFlags24h > 0 ? '#D44040' : '#3DAF96'],
    ['Mirror resonance', stats.resonanceRate !== null && stats.resonanceRate !== undefined ? `${stats.resonanceRate}%` : '—',
      stats.resonanceRate !== null && stats.resonanceRate !== undefined
        ? stats.resonanceRate >= 60 ? '#3DAF96' : '#D44040'
        : undefined],
    ...(stats.mrr !== undefined ? [['MRR', `$${stats.mrr.toFixed(2)}`]] as [string, string][] : []),
  ]
  return {
    subject: `Soul Space · Daily digest · ${today}`,
    htmlContent: emailShell(`
      ${heading(`Daily digest · ${today}`)}
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        ${rows.map(([k, v, color]) => `
          <tr>
            <td style="font-size:13px;color:#8BA7B8;padding:8px 0;border-bottom:1px solid rgba(245,237,216,.05);width:55%;">${k}</td>
            <td style="font-size:16px;font-family:Georgia,serif;font-weight:300;color:${color ?? '#FAF7F0'};padding:8px 0;border-bottom:1px solid rgba(245,237,216,.05);">${v}</td>
          </tr>`).join('')}
      </table>
      ${btn('Open admin dashboard →', `${APP_URL}/admin?env=prod`)}
    `, ''),
    textContent: `Soul Space daily digest · ${today}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nAdmin: ${APP_URL}/admin?env=prod`,
  }
}
