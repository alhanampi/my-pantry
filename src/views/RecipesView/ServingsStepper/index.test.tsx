import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ServingsStepper from './index'

describe('ServingsStepper', () => {
  it('calls onChange with servings + 1 / - 1', async () => {
    const onChange = vi.fn()
    render(<ServingsStepper servings={2} onChange={onChange} />)
    expect(screen.getByText('2')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('increase quantity'))
    expect(onChange).toHaveBeenCalledWith(3)

    await userEvent.click(screen.getByLabelText('decrease quantity'))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('never decrements below min (default 1)', async () => {
    const onChange = vi.fn()
    render(<ServingsStepper servings={1} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('decrease quantity'))
    expect(onChange).toHaveBeenCalledWith(1)
  })
})
