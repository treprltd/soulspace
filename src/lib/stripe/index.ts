// Server-only module — do NOT import this in 'use client' components
// For client-safe plan constants, import from '@/lib/stripe/plans' instead
import Stripe from 'stripe'

export { FREE_SESSIONS_PER_MONTH, PLANS, type PaidPlan } from './plans'

// Lazily initialised — avoids cold-start errors when key isn't injected yet
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: '2024-06-20' })
  }
  return _stripe
}
