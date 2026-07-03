'use client'

// ── NotificationBanner ─────────────────────────────────────────────────────────
// Renders a dismissible banner at the top of a page for transient alerts.
// Used for: payment failures, session limits, expiring subscriptions.
//
// Usage:
//   <NotificationBanner type="payment_failed" onDismiss={() => setShow(false)} />

import { useState } from 'react'
import Link from 'next/link'

export type BannerType =
  | 'payment_failed'
  | 'payment_past_due'
  | 'session_limit_warning'
  | 'session_limit_reached'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'profile_incomplete'

interface NotificationBannerProps {
  type: BannerType
  /** Extra context — e.g. days remaining, sessions used */
  detail?: string | number
  onDismiss?: () => void
}

interface BannerConfig {
  bg: string
  border: string
  icon: string
  title: string
  message: (detail?: string | number) => string
  action?: { label: string; href: string }
  dismissable: boolean
}

const CONFIGS: Record<BannerType, BannerConfig> = {
  payment_failed: {
    bg: 'rgba(212,64,64,.08)',
    border: 'rgba(212,64,64,.25)',
    icon: '⚠',
    title: 'Payment failed',
    message: () => 'We couldn\'t process your last payment. Update your payment method to keep your access.',
    action: { label: 'Update payment →', href: '/settings' },
    dismissable: false,
  },
  payment_past_due: {
    bg: 'rgba(212,64,64,.06)',
    border: 'rgba(212,64,64,.2)',
    icon: '⚠',
    title: 'Payment overdue',
    message: () => 'Your subscription payment is overdue. Please update your payment method.',
    action: { label: 'Manage billing →', href: '/settings' },
    dismissable: true,
  },
  session_limit_warning: {
    bg: 'rgba(201,168,76,.06)',
    border: 'rgba(201,168,76,.2)',
    icon: '◎',
    title: 'Approaching session limit',
    message: (detail) => `You've used ${detail} of your free sessions this month. Upgrade for unlimited access.`,
    action: { label: 'See plans →', href: '/pricing' },
    dismissable: true,
  },
  session_limit_reached: {
    bg: 'rgba(201,168,76,.08)',
    border: 'rgba(201,168,76,.3)',
    icon: '◎',
    title: 'Monthly limit reached',
    message: () => 'You\'ve used all your free sessions this month. Upgrade to continue without limits.',
    action: { label: 'Upgrade now →', href: '/pricing' },
    dismissable: false,
  },
  subscription_expiring: {
    bg: 'rgba(201,168,76,.05)',
    border: 'rgba(201,168,76,.18)',
    icon: '◇',
    title: 'Subscription ending soon',
    message: (detail) => `Your subscription ends in ${detail} day${Number(detail) !== 1 ? 's' : ''}. You can resubscribe any time.`,
    action: { label: 'View settings →', href: '/settings' },
    dismissable: true,
  },
  subscription_expired: {
    bg: 'rgba(139,167,184,.05)',
    border: 'rgba(139,167,184,.15)',
    icon: '◇',
    title: 'Subscription ended',
    message: () => 'Your paid subscription has ended. Your history is still here. Upgrade to continue unlimited sessions.',
    action: { label: 'Resubscribe →', href: '/pricing' },
    dismissable: true,
  },
  profile_incomplete: {
    bg: 'rgba(201,168,76,.07)',
    border: 'rgba(201,168,76,.28)',
    icon: '◌',
    title: 'Your profile isn\'t complete yet',
    message: () => 'We\'re missing some details — name, date of birth, phone, and gender. These are required to keep your account active.',
    action: { label: 'Complete your profile →', href: '/settings' },
    dismissable: false,
  },
}

export function NotificationBanner({ type, detail, onDismiss }: NotificationBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const cfg = CONFIGS[type]

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--r-lg)',
        marginBottom: '16px',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: '21px', flexShrink: 0, marginTop: '1px', color: cfg.border.replace('rgba(', 'rgb(').replace(', .', ', ').replace(/,[^,)]+\)$/, ')') }}>
        {cfg.icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--sand)', marginBottom: '3px' }}>
          {cfg.title}
        </div>
        <div style={{ fontSize: '17px', color: 'var(--mist)', lineHeight: 1.6 }}>
          {cfg.message(detail)}
        </div>
        {cfg.action && (
          <Link
            href={cfg.action.href}
            style={{
              display: 'inline-block', marginTop: '8px', fontSize: '17px',
              fontWeight: 600, color: 'var(--gold2)', textDecoration: 'none',
            }}
          >
            {cfg.action.label}
          </Link>
        )}
      </div>

      {/* Dismiss */}
      {cfg.dismissable && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0, background: 'transparent', border: 'none',
            color: 'var(--mist)', cursor: 'pointer', fontSize: '19px',
            padding: '0 2px', lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
