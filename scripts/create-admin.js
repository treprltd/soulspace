#!/usr/bin/env node
/**
 * scripts/create-admin.js
 *
 * Provision a per-person admin account (compliance finding #1). Run by whoever
 * holds the target project's service key — nothing here has credentials.
 *
 * Requires migration 021_admin_users.sql to be applied first.
 *
 * Usage:
 *   ADMIN_EMAIL=you@you.com ADMIN_PASSWORD='a-strong-password' \
 *   SUPABASE_PROD_URL=... SUPABASE_PROD_SERVICE_KEY=... \
 *     node scripts/create-admin.js
 *
 * Env:
 *   ADMIN_EMAIL, ADMIN_PASSWORD          the new admin's credentials
 *   SUPABASE_PROD_URL / _SERVICE_KEY     (or NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
 *   ADMIN_MFA=off                        skip TOTP enrolment (default: on)
 *
 * On success it prints an otpauth:// URI — add it to your authenticator app
 * (Google Authenticator, 1Password, Authy). MFA is then required at login.
 *
 * The scrypt hash + base32 secret formats MUST match src/lib/admin/accounts.ts.
 */
'use strict'

const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const EMAIL    = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const PASSWORD = process.env.ADMIN_PASSWORD || ''
const MFA_ON   = (process.env.ADMIN_MFA || 'on').toLowerCase() !== 'off'
const URL      = process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY      = process.env.SUPABASE_PROD_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

function fail(msg) { console.error('\n❌  ' + msg + '\n'); process.exit(1) }

if (!EMAIL || !PASSWORD) fail('Set ADMIN_EMAIL and ADMIN_PASSWORD.')
if (PASSWORD.length < 12) fail('ADMIN_PASSWORD must be at least 12 characters.')
if (!URL || !KEY) fail('Set SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_KEY.')

// ── scrypt hash — format scrypt$<salt_hex>$<hash_hex> (matches accounts.ts) ──
function hashPassword(pw) {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(pw, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

// ── base32 TOTP secret (matches accounts.ts) ─────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function generateTotpSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes)
  let bits = '', out = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}
function otpauthUri(email, secret, issuer = 'Soul Space Admin') {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}

;(async () => {
  const db = createClient(URL, KEY, { auth: { persistSession: false } })

  const { data: existing } = await db.from('admin_users').select('id').eq('email', EMAIL).maybeSingle()
  if (existing) fail(`An admin with email ${EMAIL} already exists.`)

  const secret = MFA_ON ? generateTotpSecret() : null
  const row = {
    email:         EMAIL,
    password_hash: hashPassword(PASSWORD),
    totp_secret:   secret,
    mfa_enabled:   MFA_ON,
  }

  const { error } = await db.from('admin_users').insert(row)
  if (error) fail(`Insert failed: ${error.message}\n(Is migration 021 applied to this project?)`)

  console.log(`\n✅  Admin account created: ${EMAIL}`)
  if (MFA_ON) {
    console.log('\n🔐  Add this to your authenticator app (Google Authenticator / 1Password / Authy):\n')
    console.log('    ' + otpauthUri(EMAIL, secret))
    console.log('\n    Manual entry secret: ' + secret)
    console.log('\n    You will be asked for a 6-digit code at every login.')
  } else {
    console.log('\n⚠️   MFA is OFF for this account. Re-run with ADMIN_MFA=on to require a code.')
  }
  console.log('')
  process.exit(0)
})()
