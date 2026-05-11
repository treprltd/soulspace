// Client-safe plan constants — no server-only imports
// Use this file in 'use client' components

export const FREE_SESSIONS_PER_MONTH = 3

export const PLANS = {
  essentials: {
    name: 'Essentials',
    priceDisplay: '$9.99',
    period: 'month' as const,
    features: [
      'Unlimited sessions per month',
      'Full session history',
      'All 4 resonance branches',
      'All 4 seasonal responses',
    ],
  },
  insights: {
    name: 'Insights',
    priceDisplay: '$19.99',
    period: 'month' as const,
    features: [
      'Everything in Essentials',
      'Pattern tracking across sessions',
      'Season trend analysis',
      'Priority support',
    ],
  },
} as const

export type PaidPlan = keyof typeof PLANS
