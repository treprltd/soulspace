#!/usr/bin/env node
/**
 * Soul Space — One-off profile-completion reminder
 *
 * Data remediation for accounts created before the /auth/signin
 * shouldCreateUser:false fix, which left profile_complete=false and
 * name/DOB/phone/gender empty. Emails the affected users a gentle nudge to
 * finish their profile at /settings. Their *next* sign-in is already routed
 * to /profile/setup by /auth/callback's isProfileComplete check — this
 * script only covers the "email them now" half.
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-profile-completion-reminder.js [email...]
 *
 * Defaults to the two known-incomplete prod accounts if no emails given:
 *   pouja87@yahoo.com reshbety@gmail.com
 *
 * Required env vars (already in .env.local):
 *   SUPABASE_PROD_URL, SUPABASE_PROD_SERVICE_KEY
 *   BREVO_API_KEY, FROM_EMAIL, NEXT_PUBLIC_APP_URL
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.SUPABASE_PROD_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_PROD_SERVICE_KEY
const BREVO_API_KEY    = process.env.BREVO_API_KEY
const FROM_EMAIL       = process.env.FROM_EMAIL ?? 'noreply@soulspacehealth.org'
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soulspacehealth.org'

const missing = [
  !SUPABASE_URL     && 'SUPABASE_PROD_URL',
  !SERVICE_ROLE_KEY && 'SUPABASE_PROD_SERVICE_KEY',
  !BREVO_API_KEY    && 'BREVO_API_KEY',
].filter(Boolean)

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  console.error('Run with: node --env-file=.env.local scripts/send-profile-completion-reminder.js')
  process.exit(1)
}

const targets = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['pouja87@yahoo.com', 'reshbety@gmail.com']

function buildEmail() {
  const subject = 'A couple of details for your account'

  const htmlContent = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Soul Space</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 16px !important; }
      .email-card    { padding: 28px 20px !important; }
      .email-btn     { display: block !important; text-align: center !important; }
    }
    :root { color-scheme: light; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F4F0;font-family:'DM Sans',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:#F5F4F0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    A couple of account details are still needed.
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F4F0">
    <tr>
      <td align="center" class="email-wrapper" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td class="email-card" style="background:#FFFFFF;border-radius:12px;padding:40px 36px;border:1px solid #E8E4DC;">
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

              <h1 class="email-heading" style="font-family:Georgia,'Times New Roman',serif;font-weight:300;font-size:26px;color:#08111C;margin:0 0 16px;line-height:1.3;">
                A couple of details are still missing.
              </h1>
              <p style="font-size:14px;color:#4A6070;line-height:1.8;margin:0 0 16px;">
                When you signed in, a couple of account details didn&rsquo;t get saved &mdash; your name, date of birth, phone, and gender. These help keep your account secure and yours alone.
              </p>
              <p style="font-size:14px;color:#4A6070;line-height:1.8;margin:0 0 16px;">
                It only takes a minute, and your session history is exactly where you left it.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;">
                <tr>
                  <td>
                    <a href="${APP_URL}/settings" class="email-btn"
                       style="display:inline-block;background:#C9A84C;color:#08111C;font-size:14px;
                              font-weight:600;padding:13px 28px;border-radius:8px;
                              text-decoration:none;letter-spacing:0.01em;">
                      Complete your profile &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px;border-top:1px solid #EEE9DF;">
                <tr>
                  <td style="padding-top:20px;">
                    <p style="font-size:11px;color:#9AA8B5;line-height:1.7;margin:0;">
                      Soul Space &middot; Non-clinical &middot; Non-diagnostic &middot; Not a crisis service<br>
                      <a href="${APP_URL}/settings" style="color:#9AA8B5;">Account settings</a>
                      &nbsp;&middot;&nbsp;
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

  const textContent = `A couple of account details are still missing — your name, date of birth, phone, and gender.\n\nThese help keep your account secure and yours alone. It only takes a minute, and your session history is exactly where you left it.\n\nComplete your profile: ${APP_URL}/settings`

  return { subject, htmlContent, textContent }
}

async function sendEmail(to) {
  const { subject, htmlContent, textContent } = buildEmail()
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Soul Space', email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    }),
  })
  if (!res.ok) {
    throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`)
  }
}

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const email of targets) {
    const { data: user, error } = await db
      .from('users')
      .select('id, email, profile_complete')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.error(`✗ ${email} — lookup failed: ${error.message}`)
      continue
    }
    if (!user) {
      console.log(`- ${email} — no matching user, skipped`)
      continue
    }
    if (user.profile_complete) {
      console.log(`- ${email} — profile already complete, skipped`)
      continue
    }

    try {
      await sendEmail(email)
      console.log(`✓ ${email} — reminder sent`)
    } catch (e) {
      console.error(`✗ ${email} — send failed: ${e.message}`)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
