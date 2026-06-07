/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { SeasonVisual } from '@/components/session/SeasonVisual'
import type { Season } from '@/types'

const SEASONS: Season[] = ['W', 'Sp', 'Su', 'Au']

describe('SeasonVisual', () => {
  it.each(SEASONS)('renders a distinct scene for season %s', (season) => {
    render(<SeasonVisual season={season} />)
    const visual = screen.getByTestId('season-visual')
    expect(visual).toHaveAttribute('data-season', season)
  })

  it('is purely decorative — hidden from assistive tech', () => {
    render(<SeasonVisual season="W" />)
    expect(screen.getByTestId('season-visual')).toHaveAttribute('aria-hidden', 'true')
  })

  it('respects the requested size', () => {
    render(<SeasonVisual season="Su" size={64} />)
    const visual = screen.getByTestId('season-visual')
    expect(visual).toHaveStyle({ width: '64px', height: '64px' })
  })

  it('defaults to a 96px scene when no size is given', () => {
    render(<SeasonVisual season="Sp" />)
    const visual = screen.getByTestId('season-visual')
    expect(visual).toHaveStyle({ width: '96px', height: '96px' })
  })

  it('renders without throwing for every known season id', () => {
    SEASONS.forEach(season => {
      expect(() => render(<SeasonVisual season={season} />)).not.toThrow()
    })
  })
})
