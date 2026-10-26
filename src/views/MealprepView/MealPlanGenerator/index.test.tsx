import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealPlanGenerator from './index'
import { usePantry } from '../../../hooks/usePantry'
import { useGeolocation } from '../../../hooks/useGeolocation'
import '../../../i18n'
import i18n from '../../../i18n'

vi.mock('../../../hooks/usePantry')
vi.mock('../../../hooks/useGeolocation')

function renderGenerator(props: Partial<Parameters<typeof MealPlanGenerator>[0]> = {}) {
  return render(<MealPlanGenerator onGenerate={vi.fn()} {...props} />)
}

describe('MealPlanGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePantry).mockReturnValue({ products: [] } as never)
    vi.mocked(useGeolocation).mockReturnValue({ coords: null, error: null, requestLocation: vi.fn() } as never)
  })

  it('defaults to today, 7 days, and 2 servings', async () => {
    const onGenerate = vi.fn()
    renderGenerator({ onGenerate })

    await userEvent.click(screen.getByText(i18n.t('mealprep.generate')))

    const todayIso = new Date().toISOString().slice(0, 10)
    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: todayIso, daysCount: 7, servings: 2 }),
    )
  })

  it('lets the user pick a different start date', async () => {
    const onGenerate = vi.fn()
    renderGenerator({ onGenerate })

    const dateInput = screen.getByLabelText(i18n.t('mealprep.generator.weekStart'))
    fireEvent.change(dateInput, { target: { value: '2026-12-01' } })
    await userEvent.click(screen.getByText(i18n.t('mealprep.generate')))

    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ weekStart: '2026-12-01' }))
  })

  it('clamps daysCount between 1 and 7', async () => {
    const onGenerate = vi.fn()
    renderGenerator({ onGenerate })

    const decrease = screen.getAllByLabelText('decrease quantity')[0]
    for (let i = 0; i < 10; i++) {
      await userEvent.click(decrease)
    }
    await userEvent.click(screen.getByText(i18n.t('mealprep.generate')))

    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ daysCount: 1 }))
  })

  // No option under 90 minutes is offered — a real meal-prep session
  // covering several dishes is never realistically shorter than that (see
  // TIME_OPTIONS's own comment).
  it('shows hour labels for the longer time options and a minute label for the shortest one', () => {
    renderGenerator()
    expect(screen.getByText(i18n.t('mealprep.generator.timeMinutes', { count: 90 }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('mealprep.generator.timeHours', { count: 2 }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('mealprep.generator.timeHours', { count: 3 }))).toBeInTheDocument()
  })

  it('toggles a time option on and off', async () => {
    const onGenerate = vi.fn()
    renderGenerator({ onGenerate })

    const chip = screen.getByText(i18n.t('mealprep.generator.timeMinutes', { count: 90 }))
    await userEvent.click(chip)
    await userEvent.click(screen.getByText(i18n.t('mealprep.generate')))
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ timeAvailableMinutes: 90 }))

    onGenerate.mockClear()
    await userEvent.click(chip)
    await userEvent.click(screen.getByText(i18n.t('mealprep.generate')))
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ timeAvailableMinutes: undefined }))
  })
})
