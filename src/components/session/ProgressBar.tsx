'use client'

interface ProgressBarProps {
  step: number
  total: number
}

export function ProgressBar({ step, total }: ProgressBarProps) {
  return (
    <div className="flex gap-1 mb-3.5">
      {Array.from({ length: total }, (_, i) => {
        const state = i < step - 1 ? 'done' : i === step - 1 ? 'current' : 'todo'
        return <div key={i} className={`progress-bar ${state}`} />
      })}
    </div>
  )
}
