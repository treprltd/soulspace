// SectionIcons — small single-stroke SVG badges that sit beside section
// labels on the Reflection, Season, and Next Step screens. Same visual
// language as src/components/ui/HowItWorks.tsx (minimal stroke icons in a
// soft circular badge), scaled down for inline use next to text labels.
// Purely decorative — never replaces or paraphrases any copy, frozen or not.

interface IconProps {
  color: string
}

export function IconBadge({
  background,
  size = 26,
  children,
}: {
  background: string
  size?: number
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background }}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}

// ── Reflection + Next Step ─────────────────────────────────────────────────

// "What you're carrying" — a held pouch
export function CarryingIcon({ color }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 9V7a5 5 0 0 1 10 0v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />
      <rect x="5" y="9" width="14" height="11" rx="2.5" stroke={color} strokeWidth="1.5" fill="none" opacity="0.9" />
    </svg>
  )
}

// "What appears underneath" — layered strata, deepest layer emphasized
export function UnderneathIcon({ color }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 8l8-4 8 4-8 4-8-4z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill="none" opacity="0.5" />
      <path d="M4 12l8 4 8-4" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill="none" opacity="0.75" />
      <path d="M4 16l8 4 8-4" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill="none" opacity="1" />
    </svg>
  )
}

// "One question back to you" — two facing arcs (mirroring), reused from HowItWorks
export function MirrorQuestionIcon({ color }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12a7 7 0 0 1 7-6" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M19 12a7 7 0 0 1-7 6" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M9.5 6.5 12 6l-.4 2.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
      <path d="M14.5 17.5 12 18l.4-2.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    </svg>
  )
}

// "What seems to matter most" — a focal point
export function MattersIcon({ color }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" fill={color} opacity="0.85" />
      <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.3" opacity="0.4" fill="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

// "One thing to consider this week" — a week with one day marked
export function ConsiderWeekIcon({ color }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.4" opacity="0.5" fill="none" />
      <line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="1.2" opacity="0.4" />
      <circle cx="15" cy="15" r="2" fill={color} opacity="0.9" />
    </svg>
  )
}

// "One action for today" — a single small sun
export function TodayIcon({ color }: IconProps) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill={color} opacity="0.85" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

// ── Season tiles ─────────────────────────────────────────────────────────

// "Grounding" — an anchor
export function GroundingIcon({ color }: IconProps) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="2" stroke={color} strokeWidth="1.4" />
      <path d="M12 7v10M7 14a5 5 0 0 0 10 0" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M5 11h2M17 11h2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// "Reflection" — a still surface with a faint reflection below
export function SeasonReflectionIcon({ color }: IconProps) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.4" opacity="0.9" fill="none" />
      <line x1="4" y1="14" x2="20" y2="14" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <path d="M8 18a4 4 0 0 0 8 0" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.45" fill="none" />
    </svg>
  )
}

// "Return" — a looping arrow
export function ReturnIcon({ color }: IconProps) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M5 12a7 7 0 1 1 2.5 5.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M4 15l1.5 3.5L9 17" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    </svg>
  )
}
