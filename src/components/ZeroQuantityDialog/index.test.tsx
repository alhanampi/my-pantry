import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ZeroQuantityDialog from './index'
import '../../i18n'

const product = { id: 1, name: 'Leche', quantity: '0', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }

describe('ZeroQuantityDialog', () => {
  it('renders the product name when open', () => {
    render(<ZeroQuantityDialog open product={product} onAction={vi.fn()} />)
    expect(screen.getByText(/Leche/)).toBeInTheDocument()
  })

  it('calls onAction("cart") when the add-to-cart button is clicked', async () => {
    const onAction = vi.fn()
    render(<ZeroQuantityDialog open product={product} onAction={onAction} />)
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onAction).toHaveBeenCalledWith('cart')
  })

  it('calls onAction("cancel") when the cancel button is clicked', async () => {
    const onAction = vi.fn()
    render(<ZeroQuantityDialog open product={product} onAction={onAction} />)
    await userEvent.click(screen.getAllByRole('button')[1])
    expect(onAction).toHaveBeenCalledWith('cancel')
  })
})
