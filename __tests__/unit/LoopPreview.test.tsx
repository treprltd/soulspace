/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react'
import { LoopPreview } from '@/components/ui/LoopPreview'

describe('LoopPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders all three steps of the core loop', () => {
    render(<LoopPreview />)
    expect(screen.getByTestId('loop-step-affirm')).toBeInTheDocument()
    expect(screen.getByTestId('loop-step-ask')).toBeInTheDocument()
    expect(screen.getByTestId('loop-step-reflect')).toBeInTheDocument()
  })

  it('starts on the Affirm step', () => {
    render(<LoopPreview />)
    expect(screen.getByTestId('loop-step-affirm')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('loop-step-ask')).toHaveAttribute('data-active', 'false')
    expect(screen.getByTestId('loop-step-reflect')).toHaveAttribute('data-active', 'false')
  })

  it('advances to Ask, then Reflect, then loops back to Affirm over time', () => {
    render(<LoopPreview />)

    act(() => { jest.advanceTimersByTime(3200) })
    expect(screen.getByTestId('loop-step-ask')).toHaveAttribute('data-active', 'true')

    act(() => { jest.advanceTimersByTime(3200) })
    expect(screen.getByTestId('loop-step-reflect')).toHaveAttribute('data-active', 'true')

    act(() => { jest.advanceTimersByTime(3200) })
    expect(screen.getByTestId('loop-step-affirm')).toHaveAttribute('data-active', 'true')
  })

  it('shows copy that corresponds to the active step', () => {
    render(<LoopPreview />)
    expect(screen.getByTestId('loop-preview-copy')).toHaveTextContent(/arrive as you are/i)

    act(() => { jest.advanceTimersByTime(3200) })
    expect(screen.getByTestId('loop-preview-copy')).toHaveTextContent(/gentle questions/i)
  })

  it('cleans up its interval on unmount (no act warnings / leaks)', () => {
    const { unmount } = render(<LoopPreview />)
    unmount()
    // Advancing timers post-unmount should not throw or trigger state updates
    expect(() => act(() => { jest.advanceTimersByTime(20000) })).not.toThrow()
  })
})
