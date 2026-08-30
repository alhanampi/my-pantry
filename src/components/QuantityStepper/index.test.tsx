import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuantityStepper from './index'

describe('QuantityStepper', () => {
  it('renders the numeric value', () => {
    render(<QuantityStepper value="3" onIncrement={vi.fn()} onDecrement={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('parses a non-numeric value as 0', () => {
    render(<QuantityStepper value="" onIncrement={vi.fn()} onDecrement={vi.fn()} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('calls onIncrement when the + button is clicked', async () => {
    const onIncrement = vi.fn()
    render(<QuantityStepper value="1" onIncrement={onIncrement} onDecrement={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('increase quantity'))
    expect(onIncrement).toHaveBeenCalledOnce()
  })

  it('calls onDecrement when the - button is clicked', async () => {
    const onDecrement = vi.fn()
    render(<QuantityStepper value="1" onIncrement={vi.fn()} onDecrement={onDecrement} />)
    await userEvent.click(screen.getByLabelText('decrease quantity'))
    expect(onDecrement).toHaveBeenCalledOnce()
  })

  it('disables the decrease button at 0', () => {
    render(<QuantityStepper value="0" onIncrement={vi.fn()} onDecrement={vi.fn()} />)
    expect(screen.getByLabelText('decrease quantity')).toBeDisabled()
  })
})
