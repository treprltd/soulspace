#!/usr/bin/env node
/**
 * Soul Space — Day 6 follow-up to beta survey contacts
 *
 * Gentle single follow-up for contacts who haven't replied to the initial
 * outreach. Designed to run on Day 6 of the 8-day sprint (3 days after
 * the initial send on Day 3).
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-beta-followup.js
 *   node --env-file=.env.local scripts/send-beta-followup.js --dry-run
 *
 * IMPORTANT: Before running, remove any contacts who have already replied
 * or tried the app from the FOLLOWUP_CONTACTS array below.
 *
 * Required env vars: BREVO_API_KEY, FROM_EMAIL, NEXT_PUBLIC_APP_URL
 */

'use strict'

const DRY_RUN    = process.argv.includes('--dry-run')
const BREVO_URL  = 'https://api.brevo.com/v3/smtp/email'
const BREVO_KEY  = process.env.BREVO_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'noreply@soulspacehealth.org'
const FROM_NAME  = 'Pooja Singh – Soul Space'
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soulspacehealth.org'

if (!BREVO_KEY) {
  console.error('❌  BREVO_API_KEY is not set. Run: node --env-file=.env.local scripts/send-beta-followup.js')
  process.exit(1)
}

// ── Follow-up contact list ────────────────────────────────────────────────────
// Remove anyone who has already replied or tried the app before sending.
// This is a copy of all 27 contacts — trim it down to non-responders first.
const FOLLOWUP_CONTACTS = [
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
  { name: 'Sophia',    email: 'sophia.wright17@yahoo.com' },
  { name: 'Ava',       email: 'ava.mitchell24@yahoo.com' },
  { name: 'Emily',     email: 'emily.parker19@outlook.com' },
  { name: 'Isabella',  email: 'isabella.collins41@yahoo.com' },
  { name: 'Leah',      email: 'leah.sullivan30@yahoo.com' },
]

// ── Email builder ──────────────────────────────────────────────────────────────
function buildEmail(contact) {
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
    Just a quick follow-up — Soul Space is still here whenever you're ready.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
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
                I sent you a note a few days ago about Soul Space being live. I just wanted to check in once more — in case the timing wasn't right.
              </p>

              <p style="font-size:15px;color:#3A4A58;line-height:1.8;margin:0 0 16px;">
                It's free, takes 3–5 minutes, and doesn't need an account. If something has been sitting with you lately — a decision, a feeling, a pattern — it's designed for exactly that.
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

              <p style="font-size:15px;color:#3A4A58;line-height:1.8;margin:0 0 4px;">
                No pressure either way. Thank you for being part of this from the start.
              </p>
              <p style="font-size:15px;color:#08111C;font-weight:600;margin:0;">— Pooja</p>
              <p style="font-size:13px;color:#9AA8B5;margin:4px 0 0;">Founder, Soul Space</p>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid #EEE9DF;">
                <tr>
                  <td style="padding-top:16px;">
                    <p style="font-size:11px;color:#9AA8B5;line-height:1.7;margin:0;">
                      You're receiving this because you participated in the Soul Space survey. This is the last message we'll send about the beta launch.<br>
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

I sent you a note a few days ago about Soul Space being live. I just wanted to check in once more — in case the timing wasn't right.

It's free, takes 3–5 minutes, and doesn't need an account. If something has been sitting with you lately — a decision, a feeling, a pattern — it's designed for exactly that.

Try it: ${APP_URL}

No pressure either way. Thank you for being part of this from the start.
— Pooja
Founder, Soul Space

---
You're receiving this because you participated in the Soul Space survey. This is the last message we'll send about the beta launch.
Privacy policy: ${APP_URL}/privacy`

  return { html, text }
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function send(contact) {
  const { html, text } = buildEmail(contact)
  const subject = `Just checking in — Soul Space is still here`

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send to: ${contact.name} <${contact.email}>`)
    return
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
}

// ── Main ──────────────────────────────────────────────────────────────────────
;(async () => {
  console.log(`\n📧  Soul Space beta follow-up${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
  console.log(`    Contacts: ${FOLLOWUP_CONTACTS.length}`)
  console.log(`    From:     ${FROM_NAME} <${FROM_EMAIL}>`)
  console.log(`    ⚠️  Remove responders from FOLLOWUP_CONTACTS before sending!\n`)

  const results = { sent: [], failed: [] }

  for (const contact of FOLLOWUP_CONTACTS) {
    try {
      await send(contact)
      console.log(`  ✓  ${contact.name.padEnd(12)} <${contact.email}>`)
      results.sent.push(contact.email)
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
