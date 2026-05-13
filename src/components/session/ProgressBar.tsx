'use client'

interface ProgressBarProps {
  step: number
  total: number
  label?: string
}

export function ProgressBar({ step, total, label }: ProgressBarProps) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: label ? '6px' : 0 }}>
        {Array.from({ length: total }, (_, i) => {
          const state = i < step - 1 ? 'done' : i === step - 1 ? 'current' : 'todo'
          return <div key={i} className={`progress-bar ${state}`} />
        })}
      </div>
      {label && (
        <div style={{ fontSize: '13px', color: 'var(--mist)', fontFamily: 'var(--font-sans)' }}>
          {label}
        </div>
      )}
    </div>
  )
}
