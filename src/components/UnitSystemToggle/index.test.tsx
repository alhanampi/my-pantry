import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UnitSystemToggle from './index'
import '../../i18n'

const mockSetUnitSystem = vi.fn()
const mockUseUnitSystem = vi.fn(
  (): { unitSystem: 'metric' | 'imperial'; setUnitSystem: typeof mockSetUnitSystem; isPending: boolean } => ({
    unitSystem: 'metric',
    setUnitSystem: mockSetUnitSystem,
    isPending: false,
  }),
)
vi.mock('../../hooks/useUnitSystem', () => ({
  useUnitSystem: () => mockUseUnitSystem(),
}))

describe('UnitSystemToggle', () => {
  it('renders as an unchecked switch (metric) with the metric label', () => {
    render(<UnitSystemToggle />)
    expect(screen.getByText('Metric')).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('toggles to imperial on click', async () => {
    render(<UnitSystemToggle />)
    await userEvent.click(screen.getByRole('switch'))
    expect(mockSetUnitSystem).toHaveBeenCalledWith('imperial')
  })

  it('renders checked (imperial) and toggles back to metric', async () => {
    mockUseUnitSystem.mockReturnValueOnce({ unitSystem: 'imperial', setUnitSystem: mockSetUnitSystem, isPending: false })
    render(<UnitSystemToggle />)

    expect(screen.getByText('Imperial')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeChecked()

    await userEvent.click(screen.getByRole('switch'))
    expect(mockSetUnitSystem).toHaveBeenCalledWith('metric')
  })

  it('disables the switch while a change is pending', () => {
    mockUseUnitSystem.mockReturnValueOnce({ unitSystem: 'metric', setUnitSystem: mockSetUnitSystem, isPending: true })
    render(<UnitSystemToggle />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
