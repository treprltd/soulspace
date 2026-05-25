'use client'

interface ProgressBarProps {
  step: number
  total: number
}

// Calm-style pill indicator: current step = wider pill, done = small dimmed dot, todo = faint dot
export function ProgressBar({ step, total }: ProgressBarProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-7">
      {Array.from({ length: total }, (_, i) => {
        const isDone    = i < step - 1
        const isCurrent = i === step - 1
        return (
          <div
            key={i}
            className="progress-dot"
            style={{
              width:      isCurrent ? '22px' : '6px',
              background: (isDone || isCurrent) ? 'var(--gold)' : 'rgba(245,237,216,.1)',
              opacity:    isDone ? 0.45 : 1,
            }}
          />
        )
      })}
    </div>
  )
}
