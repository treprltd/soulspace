import { checkInEmail } from '@/lib/copy/memory'

// Soul Space — transactional email utility
// Auth magic links go through Supabase's custom SMTP (configured in Supabase dashboard).
// All other emails (welcome, subscription, re-engagement) are sent via Brevo (Sendinblue).
//
// Design principle: light background (#F5F4F0 body, #FFFFFF card) so the email
// renders correctly on all clients — iOS Gmail, Apple Mail, Outlook, dark-mode.
// Dark backgrounds on emails cause blank/black blocks on iOS before scroll.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const FROM_EMAIL    = process.env.FROM_EMAIL ?? 'noreply@soulspacehealth.org'
const FROM_NAME     = 'Soul Space'
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soulspacehealth.org'

interface SendEmailOptions {
  to:           string
  toName?:      string
  subject:      string
  htmlContent:  string
  textContent?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'api-key':      apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: opts.to, name: opts.toName ?? opts.to }],
      subject:     opts.subject,
      htmlContent: opts.htmlContent,
      textContent: opts.textContent,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo send failed: ${res.status} ${err}`)
  }
}

// ── Shared email shell ────────────────────────────────────────────────────────
// Light background (#F5F4F0 outer, #FFFFFF card) — renders correctly on all
// email clients including iOS Gmail / Apple Mail. Table-based layout for
// maximum compatibility. All styles are inline.
function emailShell(body: string, preheader = '', footerNote = ''): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if !mso]><!-->
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <!--<![endif]-->
  <title>Soul Space</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper  { padding: 16px !important; }
      .email-card     { padding: 28px 20px !important; }
      .email-heading  { font-size: 22px !important; }
      .email-btn      { display: block !important; text-align: center !important; }
    }
    /* Force light mode — prevent iOS Mail dark-mode inversion */
    :root { color-scheme: light; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F4F0;font-family:'DM Sans',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">

  <!-- Preheader (hidden preview text in inbox) -->
  <div style="display:none;font-size:1px;color:#F5F4F0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader || 'Soul Space — the structured pause between emotional overload and consequential action.'}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F4F0">
    <tr>
      <td align="center" class="email-wrapper" style="padding:40px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td class="email-card" style="background:#FFFFFF;border-radius:12px;padding:40px 36px;border:1px solid #E8E4DC;">

              <!-- Logo row -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:300;color:#08111C;letter-spacing:0.02em;">
                      Soul <span style="color:#C9A84C;">Space</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;">
                    <div style="width:36px;height:1px;background:#C9A84C;opacity:0.4;"></div>
                  </td>
                </tr>
              </table>

              <!-- Body content -->
              ${body}

              <!-- Footer inside card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px;border-top:1px solid #EEE9DF;">
                <tr>
                  <td style="padding-top:20px;">
                    <p style="font-size:11px;color:#9AA8B5;line-height:1.7;margin:0;">
                      ${footerNote ? `${footerNote}<br>` : ''}
                      Soul Space · Non-clinical · Non-diagnostic · Not a crisis service<br>
                      <a href="${APP_URL}/settings" style="color:#9AA8B5;">Account settings</a>
                      &nbsp;·&nbsp;
                      <a href="${APP_URL}/privacy" style="color:#9AA8B5;">Privacy</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`
}

// ── Shared component helpers ───────────────────────────────────────────────────

function btn(label: string, href: string, bg = '#C9A84C', color = '#08111C'): string {
  return `
  <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;">
    <tr>
      <td>
        <a href="${href}" class="email-btn"
           style="display:inline-block;background:${bg};color:${color};font-size:14px;
                  font-weight:600;padding:13px 28px;border-radius:8px;
                  text-decoration:none;letter-spacing:0.01em;mso-padding-alt:0;
                  -webkit-text-size-adjust:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

function heading(text: string): string {
  return `<h1 class="email-heading"
    style="font-family:Georgia,'Times New Roman',serif;font-weight:300;
           font-size:26px;color:#08111C;margin:0 0 16px;line-height:1.3;">
    ${text}
  </h1>`
}

function para(text: string): string {
  return `<p style="font-size:14px;color:#4A6070;line-height:1.8;margin:0 0 16px;">${text}</p>`
}

function alertBox(text: string, borderColor = '#C9A84C'): string {
  const bg = borderColor === '#D44040'
    ? '#FEF2F2'
    : borderColor === '#3DAF96'
    ? '#F0FAF7'
    : '#FEFBF3'
  const textColor = borderColor === '#D44040'
    ? '#B91C1C'
    : borderColor === '#3DAF96'
    ? '#0F6652'
    : '#7A5C1E'
  return `
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
    <tr>
      <td style="border-left:3px solid ${borderColor};background:${bg};
                 border-radius:0 6px 6px 0;padding:12px 16px;">
        <p style="font-size:13px;color:${textColor};margin:0;line-height:1.6;">${text}</p>
      </td>
    </tr>
  </table>`
}

// ── Email templates ───────────────────────────────────────────────────────────

/** Sent when a user signs in for the very first time (new account created). */
export function welcomeEmail(): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'You found a quiet place.',
    htmlContent: emailShell(
      `${heading('Whatever brought you here —')}
       ${para('You do not need to have it figured out yet. Soul Space is a quiet 5–10 minute space to hear what you are carrying — without judgment, without advice, without a diagnosis.')}
       ${para('Pick what feels closest. The Mirror reflects it back. That\'s it.')}
       ${alertBox('Everything you share is end-to-end encrypted. We can\'t read it — and we never try.')}
       ${btn('Begin your first session →', `${APP_URL}/age-gate`)}`,
      'Your Soul Space account is ready.',
      'You received this because you created a Soul Space account.',
    ),
    textContent: `Whatever brought you here — you do not need to have it figured out yet.\n\nSoul Space is a quiet 5–10 minute space to hear what you are carrying. No judgment, no advice, no diagnosis.\n\nBegin your first session: ${APP_URL}/age-gate`,
  }
}

/** Sent when checkout.session.completed fires — subscription now active. */
export function subscriptionConfirmationEmail(planName: string): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: `${planName} is ready for you.`,
    htmlContent: emailShell(
      `${heading(`Welcome to <em style="color:#C9A84C;">${planName}.</em>`)}
       ${para('Your subscription is active. Unlimited sessions are now available whenever you need them.')}
       ${para('Everything you share remains encrypted and private — that hasn\'t changed.')}
       ${btn('Begin a session →', `${APP_URL}/age-gate`)}`,
      `Your Soul Space ${planName} subscription is now active.`,
      'Manage or cancel any time from your account settings.',
    ),
    textContent: `Welcome to Soul Space ${planName}.\n\nYour subscription is active. Unlimited sessions are now available.\n\nBegin a session: ${APP_URL}/age-gate\n\nManage your subscription: ${APP_URL}/settings`,
  }
}

/** Sent when cancel_at_period_end becomes true. */
export function subscriptionCancellationEmail(planName: string, periodEnd: string): { subject: string; htmlContent: string; textContent: string } {
  const endDate = new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return {
    subject: 'Cancellation confirmed — your access continues.',
    htmlContent: emailShell(
      `${heading('Cancellation confirmed.')}
       ${para(`Your <strong style="color:#08111C;">${planName}</strong> subscription has been cancelled.`)}
       ${para(`You'll keep full access until <strong style="color:#08111C;">${endDate}</strong>. After that, your account moves to the free plan — your session history stays with you.`)}
       ${alertBox('Changed your mind? You can resubscribe any time from your account settings before the end date.', '#3DAF96')}
       ${btn('View account settings', `${APP_URL}/settings`)}`,
      `Your Soul Space ${planName} access continues until ${endDate}.`,
      'We\'re sorry to see you go.',
    ),
    textContent: `Your Soul Space ${planName} subscription has been cancelled.\n\nYou keep full access until ${endDate}. After that, your account moves to the free plan.\n\nChanged your mind? Resubscribe any time: ${APP_URL}/settings`,
  }
}

/** Sent when customer.subscription.deleted fires. */
export function subscriptionExpiredEmail(): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'Until next time.',
    htmlContent: emailShell(
      `${heading('Your subscription has ended.')}
       ${para('Your paid access to Soul Space has ended. Your account is now on the free plan.')}
       ${para('Your session history is still here. The free plan gives you sessions each month — more than enough to come back whenever you need to.')}
       ${btn('Resubscribe →', `${APP_URL}/pricing`)}`,
      'Your Soul Space subscription has ended.',
    ),
    textContent: `Your Soul Space subscription has ended. Your account is now on the free plan.\n\nYour session history is still here.\n\nResubscribe: ${APP_URL}/pricing`,
  }
}

/** Sent when invoice.payment_failed fires. */
export function paymentFailedEmail(planName: string, retryDate?: string): { subject: string; htmlContent: string; textContent: string } {
  const retryText = retryDate
    ? `Stripe will automatically retry your payment on <strong style="color:#08111C;">${new Date(retryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</strong>.`
    : 'Stripe will automatically retry your payment in the next few days.'
  return {
    subject: 'A quick note about your payment.',
    htmlContent: emailShell(
      `${heading('We couldn\'t process your payment.')}
       ${alertBox('Your Soul Space payment failed. Please update your payment method to keep your access.', '#D44040')}
       ${para(`You\'re currently on <strong style="color:#08111C;">${planName}</strong>. ${retryText}`)}
       ${para('If payment continues to fail, your account will be moved to the free plan.')}
       ${btn('Update payment method →', `${APP_URL}/settings`, '#D44040', '#FFFFFF')}`,
      'Action needed — update your payment method.',
    ),
    textContent: `Your Soul Space payment failed.\n\nPlease update your payment method to keep your ${planName} access.\n\nUpdate payment: ${APP_URL}/settings`,
  }
}

/** Sent when invoice.payment_succeeded after a previous failure. */
export function paymentRecoveredEmail(planName: string): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'All good — you\'re back.',
    htmlContent: emailShell(
      `${heading('Payment successful.')}
       ${para(`Your <strong style="color:#08111C;">${planName}</strong> subscription is active again. No further action needed.`)}
       ${btn('Begin a session →', `${APP_URL}/age-gate`)}`,
      'Your Soul Space subscription is active again.',
    ),
    textContent: `Your Soul Space ${planName} subscription is active again.\n\nBegin a session: ${APP_URL}/age-gate`,
  }
}

/** Sent immediately before the user's data is deleted. */
export function accountDeletionEmail(): { subject: string; htmlContent: string; textContent: string } {
  return {
    subject: 'Your account and data have been removed.',
    htmlContent: emailShell(
      `${heading('Account deleted.')}
       ${para('Your Soul Space account and all associated session data have been permanently deleted.')}
       ${para('This includes your session history, emotions data, and any reflections. Nothing is retained on our servers.')}
       ${para('If you\'d like to return, you can create a new account any time — no trace of the old one will remain.')}`,
      'Your Soul Space account has been deleted.',
      'This action was requested from your account settings.',
    ),
    textContent: `Your Soul Space account and all session data have been permanently deleted.\n\nNothing is retained. You can create a new account any time: ${APP_URL}`,
  }
}

/** Sent to inactive users who haven't had a session in 7+ days. */
export function reEngagementEmail(daysSinceLastSession: number): { subject: string; htmlContent: string; textContent: string } {
  const subjects = [
    'Whenever you\'re ready.',
    'The pause is still here.',
    'It\'s been a little while.',
    'No need to have it figured out.',
  ]
  const subject = subjects[Math.floor(daysSinceLastSession / 7) % subjects.length]
  return {
    subject,
    htmlContent: emailShell(
      `${heading('You don\'t need to have it figured out.')}
       ${para('Soul Space isn\'t something you need to use every day. There\'s no schedule. No streak to maintain.')}
       ${para('But if something\'s been sitting with you — something you haven\'t quite been able to name — this is a quiet place to put it down for a moment.')}
       ${btn('Return whenever you\'re ready →', `${APP_URL}/age-gate`)}`,
      'Soul Space is here whenever you\'re ready.',
      'To stop receiving these emails, visit your account settings.',
    ),
    textContent: `Soul Space is here whenever you're ready.\n\nNo schedule. No streak to maintain. Just a quiet place for what you're carrying.\n\nReturn: ${APP_URL}/age-gate\n\nTo unsubscribe: ${APP_URL}/settings`,
  }
}

/**
 * Sent only to users who opted in via check_in_frequency (off by default).
 * Wraps the locked copy from src/lib/copy/memory.ts (checkInEmail) into the
 * email-shell template. The copy itself is frozen — do not alter wording here;
 * this function only handles HTML/text presentation of those exact strings.
 */
export function checkInDigestEmail(
  firstName: string,
  memoryNote: string | null | undefined,
  subjectIndex = 0
): { subject: string; htmlContent: string; textContent: string } {
  const content = checkInEmail(firstName, memoryNote, subjectIndex)
  const paragraphs = content.body.split('\n\n')

  return {
    subject: content.subject,
    htmlContent: emailShell(
      `${heading(content.greeting)}
       ${paragraphs.map(p => para(p)).join('\n')}
       ${btn(content.cta, `${APP_URL}/age-gate`)}`,
      content.subject,
      content.footer,
    ),
    textContent: `${content.greeting}\n\n${content.body}\n\n${content.cta.replace(' →', '')}: ${APP_URL}/age-gate\n\n${content.footer}`,
  }
}

// ── Admin alert emails ────────────────────────────────────────────────────────

/** Sent to ADMIN_EMAIL when a safety flag fires. */
export function adminSafetyAlertEmail(opts: {
  sessionId:       string
  flagType:        string
  branch:          string | null
  flagsUnreviewed: number
}): { subject: string; htmlContent: string; textContent: string } {
  const rows = [
    ['Flag type',                    opts.flagType || 'unspecified'],
    ['Branch',                       opts.branch   || 'unknown'],
    ['Unreviewed flags (all time)',   String(opts.flagsUnreviewed)],
  ]
  return {
    subject: '⚑ Safety alert — crisis flag triggered',
    htmlContent: emailShell(
      `${alertBox(`A crisis safety flag was triggered in session <strong>${opts.sessionId.slice(0, 8)}</strong>.`, '#D44040')}
       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
         ${rows.map(([k, v]) => `
           <tr>
             <td style="font-size:12px;color:#4A6070;padding:7px 0;border-bottom:1px solid #EEE9DF;width:55%;">${k}</td>
             <td style="font-size:12px;color:#08111C;padding:7px 0;border-bottom:1px solid #EEE9DF;font-weight:500;">${v}</td>
           </tr>`).join('')}
       </table>
       ${btn('Review in admin panel →', `${APP_URL}/admin/safety?env=prod`, '#D44040', '#FFFFFF')}`,
      'Crisis safety flag triggered — review required.',
    ),
    textContent: `Safety alert: crisis flag triggered.\n\nSession: ${opts.sessionId}\nFlag type: ${opts.flagType}\nBranch: ${opts.branch}\nUnreviewed: ${opts.flagsUnreviewed}\n\nReview: ${APP_URL}/admin/safety?env=prod`,
  }
}

/** Sent to ADMIN_EMAIL each morning with key overnight metrics. */
export function adminDailyDigestEmail(stats: {
  newUsers:       number
  sessions24h:    number
  safetyFlags24h: number
  mrr?:           number
  resonanceRate?: number | null
}): { subject: string; htmlContent: string; textContent: string } {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const rows: [string, string, string?][] = [
    ['New users (24h)',   stats.newUsers.toString()],
    ['Sessions (24h)',    stats.sessions24h.toString()],
    ['Safety flags (24h)', stats.safetyFlags24h.toString(),
      stats.safetyFlags24h > 0 ? '#D44040' : '#0F6652'],
    ['Mirror resonance',
      stats.resonanceRate != null ? `${stats.resonanceRate}%` : '—',
      stats.resonanceRate != null ? (stats.resonanceRate >= 60 ? '#0F6652' : '#D44040') : undefined],
    ...(stats.mrr !== undefined ? [['MRR', `$${stats.mrr.toFixed(2)}`] as [string, string]] : []),
  ]
  return {
    subject: `Soul Space · Daily digest · ${today}`,
    htmlContent: emailShell(
      `${heading(`Daily digest · ${today}`)}
       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
         ${rows.map(([k, v, color]) => `
           <tr>
             <td style="font-size:13px;color:#4A6070;padding:9px 0;border-bottom:1px solid #EEE9DF;width:60%;">${k}</td>
             <td style="font-size:18px;font-family:Georgia,serif;font-weight:300;
                        color:${color ?? '#08111C'};padding:9px 0;border-bottom:1px solid #EEE9DF;">${v}</td>
           </tr>`).join('')}
       </table>
       ${btn('Open admin dashboard →', `${APP_URL}/admin?env=prod`)}`,
      `Soul Space metrics for ${today}.`,
    ),
    textContent: `Soul Space daily digest · ${today}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nAdmin: ${APP_URL}/admin?env=prod`,
  }
}
