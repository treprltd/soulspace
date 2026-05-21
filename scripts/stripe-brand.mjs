/**
 * Sets Soul Space brand colours on the Stripe account so they appear
 * on every hosted Checkout page.
 *
 * Run:  node scripts/stripe-brand.mjs
 *
 * Reads STRIPE_SECRET_KEY from .env.local automatically.
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ── Read .env.local ────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_KEY) {
  console.error('❌  STRIPE_SECRET_KEY not found in environment or .env.local')
  process.exit(1)
}

// ── Soul Space brand tokens ────────────────────────────────────────────────
// primary_color   → background / dominant colour on the checkout page
// secondary_color → button / accent colour (maps to btn-primary)
const BRANDING = {
  primary_color:   '#0F1E2E',   // --ink2 (dark navy — matches app bg)
  secondary_color: '#C9A84C',   // --gold (CTA buttons)
}

// ── POST /v1/account ───────────────────────────────────────────────────────
const body = new URLSearchParams({
  'settings[branding][primary_color]':   BRANDING.primary_color,
  'settings[branding][secondary_color]': BRANDING.secondary_color,
}).toString()

const options = {
  hostname: 'api.stripe.com',
  port: 443,
  path: '/v1/account',
  method: 'POST',
  headers: {
    Authorization: `Bearer ${STRIPE_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  },
}

console.log('Updating Stripe account branding…')
console.log('  primary_color  :', BRANDING.primary_color, ' (Soul Space ink2 — page background)')
console.log('  secondary_color:', BRANDING.secondary_color, ' (Soul Space gold — buttons)')

const req = https.request(options, (res) => {
  let raw = ''
  res.on('data', (chunk) => { raw += chunk })
  res.on('end', () => {
    if (res.statusCode === 200) {
      let account
      try { account = JSON.parse(raw) } catch { account = {} }
      const b = account?.settings?.branding ?? {}
      console.log('\n✅  Branding updated on Stripe account.')
      console.log('   primary_color  :', b.primary_color)
      console.log('   secondary_color:', b.secondary_color)
      if (b.logo) console.log('   logo           :', b.logo)
      console.log('\nNew checkout sessions will reflect these colours.')
      console.log('Open a fresh /checkout/essentials link to see the change.')
    } else {
      console.error('\n❌  Stripe returned status', res.statusCode)
      try { console.error(JSON.stringify(JSON.parse(raw), null, 2)) }
      catch { console.error(raw) }
      process.exit(1)
    }
  })
})

req.on('error', (e) => {
  console.error('❌  Request error:', e.message)
  process.exit(1)
})

req.write(body)
req.end()
