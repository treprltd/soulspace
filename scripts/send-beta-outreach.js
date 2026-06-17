#!/usr/bin/env node
/**
 * Soul Space — Beta outreach to survey respondents
 *
 * Sends a personalised email to each survey contact who indicated Yes/Maybe
 * to trying an early version of Soul Space. Modelled after the existing
 * send-profile-completion-reminder.js pattern.
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-beta-outreach.js
 *   node --env-file=.env.local scripts/send-beta-outreach.js --dry-run
 *
 * Required env vars (in .env.local):
 *   BREVO_API_KEY, FROM_EMAIL, NEXT_PUBLIC_APP_URL
 */

'use strict'

const DRY_RUN    = process.argv.includes('--dry-run')
const BREVO_URL  = 'https://api.brevo.com/v3/smtp/email'
const BREVO_KEY  = process.env.BREVO_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'noreply@soulspacehealth.org'
const FROM_NAME  = 'Pooja Singh – Soul Space'
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soulspacehealth.org'

if (!BREVO_KEY) {
  console.error('❌  BREVO_API_KEY is not set. Run: node --env-file=.env.local scripts/send-beta-outreach.js')
  process.exit(1)
}

// ── Contact list ─────────────────────────────────────────────────────────────
// Survey respondents who said Yes or Maybe to trying an early version.
// Source: 3-Minute Soul Space Survey CSV (June 2026).
const YES_CONTACTS = [
  { name: 'Puja',      email: 'poojasingh3462@gmail.com' },
  { name: 'Danny',     email: 'daniel_hughes88@outlook.com' },
  { name: 'Olivia',    email: 'olivia.bennett03@gmail.com' },
  { name: 'Ethan',     email: 'ethan.carter55@hotmail.com' },
  { name: 'Michael',   email: 'michael.turner77@gmail.com' },
  { name: 'James',     email: 'james.evans66@gmail.com' },
  { name: 'Mia',       email: 'mia.roberts28@hotmail.com' },
  { name: 'Benjamin',  email: 'benjamin.cook14@gmail.com' },
  { name: 'Charlotte', email: 'charlotte.bell73@outlook.com' },
  { name: 'William',   email: 'william.bailey39@yahoo.com' },
  { name: 'Amelia',    email: 'amelia.rivera62@gmail.com' },
  { name: 'Lucas',     email: 'lucas.cooper85@hotmail.com' },
  { name: 'Harper',    email: 'harper.richardson21@gmail.com' },
  { name: 'Sukanya',   email: 'sukanyakbabu@gmail.com' },
  { name: 'Liberty',   email: 'lfloyd2611@gmail.com' },
  { name: 'Aadi',      email: 'aadisingh3462@gmail.com' },
  { name: 'Madison',   email: 'madison.fleming19@outlook.com' },
  { name: 'Owen',      email: 'owen.bryant46@gmail.com' },
  { name: 'Caleb',     email: 'caleb.hendrix67@hotmail.com' },
  { name: 'Hannah',    email: 'hannah.patterson38@yahoo.com' },
  { name: 'Zoe',       email: 'zoe.long14@hotmail.com' },
  { name: 'Logan',     email: 'logan.perry63@outlook.com' },
]

const MAYBE_CONTACTS = [
  { name: 'Sophia',   email: 'sophia.wright17@yahoo.com' },
  { name: 'Ava',      email: 'ava.mitchell24@yahoo.com' },
  { name: 'Emily',    email: 'emily.parker19@outlook.com' },
  { name: 'Isabella', email: 'isabella.collins41@yahoo.com' },
  { name: 'Leah',     email: 'leah.sullivan30@yahoo.com' },
]

// ── Email builder ─────────────────────────────────────────────────────────────
function buildEmail(contact, isMaybe) {
  const intro = isMaybe
    ? `A few weeks ago you filled out our survey and said you <em>might</em> be open to trying Soul Space.`
    : `A few weeks ago you filled out our survey and said you'd be open to trying Soul Space.`

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Soul Space</title>
  <style>
    @media only screen and (max-width:600px){
      .wrap{padding:16px !important;}
      .card{padding:28px 20px !important;}
    }
    :root{color-scheme:light;}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F4F0;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;color:#F5F4F0;line-height:1px;max-height:0;overflow:hidden;">
    Soul Space is live — you said you'd be open to trying it.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F4F0">
    <tr>
      <td align="center" class="wrap" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td class="card" style="background:#FFFFFF;border-radius:12px;padding:40px 36px;border:1px solid #E8E4DC;">

              <!-- Logo -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:300;color:#08111C;letter-spacing:0.02em;">
                      Soul <span style="color:#C9A84C;">Space</span>
                    </span>
                  </td>
                </tr>
                <tr><td style="padding-top:10px;"><div style="width:36px;height:1px;background:#C9A84C;opacity:0.4;"></div></td></tr>
              </table>

              <!-- Greeting -->
              <p style="font-size:16px;color:#08111C;line-height:1.7;margin:0 0 16px;">Hi ${contact.name},</p>

              <!-- Body -->
              <p style="font-size:15px;color:#3A4A58;line-height:1.8;margin:0 0 16px;">
                ${intro} I wanted to reach out personally — it's ready.
              </p>

              <p style="font-size:15px;color:#3A4A58;line-height:1.8;margin:0 0 16px;">
                Soul Space is a 3–5 minute pause you take before a decision that's been weighing on you.
                You share what you're carrying, and it gives you a short, specific reflection back —
                not advice, not a diagnosis. Just a clearer look at what might be underneath it.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
                <tr>
                  <td style="background:#C9A84C;border-radius:8px;">
                    <a href="${APP_URL}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#08111C;text-decoration:none;letter-spacing:0.04em;">
                      Try Soul Space →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:15px;color:#3A4A58;line-height:1.8;margin:0 0 16px;">
                Free to try. No account needed. If it helps — even a little — I'd genuinely love to hear what you think.
                And if it doesn't land, that feedback is just as valuable.
              </p>

              <p style="font-size:15px;color:#3A4A58;line-height:1.8;margin:0 0 4px;">
                Thank you for being part of this from the beginning.
              </p>
              <p style="font-size:15px;color:#08111C;font-weight:600;margin:0;">— Pooja</p>
              <p style="font-size:13px;color:#9AA8B5;margin:4px 0 0;">Founder, Soul Space</p>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid #EEE9DF;">
                <tr>
                  <td style="padding-top:16px;">
                    <p style="font-size:11px;color:#9AA8B5;line-height:1.7;margin:0;">
                      You're receiving this because you filled out the Soul Space survey and indicated you'd be open to trying an early version.<br>
                      Soul Space · Non-clinical · Non-diagnostic · Not a crisis service<br>
                      <a href="${APP_URL}/privacy" style="color:#9AA8B5;">Privacy policy</a>
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

  const text = `Hi ${contact.name},

${isMaybe ? 'A few weeks ago you filled out our survey and said you might be open to trying Soul Space.' : 'A few weeks ago you filled out our survey and said you\'d be open to trying Soul Space.'} I wanted to reach out personally — it's ready.

Soul Space is a 3–5 minute pause you take before a decision that's been weighing on you. You share what you're carrying, and it gives you a short, specific reflection back — not advice, not a diagnosis. Just a clearer look at what might be underneath it.

Try it free at: ${APP_URL}

No account needed. If it helps — even a little — I'd genuinely love to hear what you think.

Thank you for being part of this from the beginning.
— Pooja
Founder, Soul Space

---
You're receiving this because you filled out the Soul Space survey and indicated you'd be open to trying an early version.
Privacy policy: ${APP_URL}/privacy`

  return { html, text }
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function send(contact, isMaybe) {
  const { html, text } = buildEmail(contact, isMaybe)
  const subject = isMaybe
    ? `You mentioned you might be open to trying Soul Space — it's ready`
    : `You said you'd be open to trying Soul Space — it's ready`

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send to: ${contact.name} <${contact.email}>`)
    return { ok: true }
  }

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: contact.email, name: contact.name }],
      replyTo:     { email: 'founder@soulspacehealth.com', name: 'Pooja Singh – Soul Space' },
      subject,
      htmlContent: html,
      textContent: text,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo error for ${contact.email}: ${res.status} ${err}`)
  }
  return { ok: true }
}

// ── Main ──────────────────────────────────────────────────────────────────────
;(async () => {
  const allContacts = [
    ...YES_CONTACTS.map(c => ({ ...c, maybe: false })),
    ...MAYBE_CONTACTS.map(c => ({ ...c, maybe: true })),
  ]

  console.log(`\n📧  Soul Space beta outreach${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
  console.log(`    Contacts: ${allContacts.length} (${YES_CONTACTS.length} Yes · ${MAYBE_CONTACTS.length} Maybe)`)
  console.log(`    From:     ${FROM_NAME} <${FROM_EMAIL}>`)
  console.log(`    App URL:  ${APP_URL}\n`)

  const results = { sent: [], failed: [] }

  for (const contact of allContacts) {
    try {
      await send(contact, contact.maybe)
      console.log(`  ✓  ${contact.name.padEnd(12)} <${contact.email}>`)
      results.sent.push(contact.email)
      // 300ms between sends — Brevo rate limit safe
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error(`  ✗  ${contact.name.padEnd(12)} <${contact.email}> — ${err.message}`)
      results.failed.push({ email: contact.email, error: err.message })
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`✅  Sent:   ${results.sent.length}`)
  if (results.failed.length > 0) {
    console.log(`❌  Failed: ${results.failed.length}`)
    results.failed.forEach(f => console.log(`     ${f.email}: ${f.error}`))
  }
  console.log()
})()
