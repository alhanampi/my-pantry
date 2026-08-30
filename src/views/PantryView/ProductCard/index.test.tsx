import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductCard from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { Product } from '../../../utils/types'

const product: Product = {
  id: 1,
  name: 'Leche',
  quantity: '2',
  brand: 'La Serenísima',
  purchaseDate: '2026-08-01',
  expiryDate: '2026-08-25',
  location: 'Heladera',
  details: 'Descremada',
}

describe('ProductCard', () => {
  it('renders the summary row', () => {
    render(<ProductCard product={product} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={vi.fn()} onQuantityChange={vi.fn()} />)
    expect(screen.getByText('Leche')).toBeInTheDocument()
  })

  it('expands to show details when the summary row is clicked', async () => {
    render(<ProductCard product={product} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={vi.fn()} onQuantityChange={vi.fn()} />)
    await userEvent.click(screen.getByText('Leche'))
    expect(screen.getByText('Heladera')).toBeInTheDocument()
    expect(screen.getByText('Descremada')).toBeInTheDocument()
  })

  it('calls onAddToCart when the cart icon is clicked', async () => {
    const onAddToCart = vi.fn()
    render(<ProductCard product={product} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={onAddToCart} onQuantityChange={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(i18n.t('card.addToCart')))
    expect(onAddToCart).toHaveBeenCalledWith(product)
  })

  it('calls onQuantityChange when the stepper is used', async () => {
    const onQuantityChange = vi.fn()
    render(<ProductCard product={product} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={vi.fn()} onQuantityChange={onQuantityChange} />)
    await userEvent.click(screen.getByLabelText('increase quantity'))
    expect(onQuantityChange).toHaveBeenCalledWith(1, 1)
  })

  it('calls onEdit and onDelete from the expanded actions', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<ProductCard product={product} onDelete={onDelete} onEdit={onEdit} onAddToCart={vi.fn()} onQuantityChange={vi.fn()} />)
    await userEvent.click(screen.getByText('Leche'))
    await userEvent.click(screen.getByText(i18n.t('card.edit')))
    expect(onEdit).toHaveBeenCalledWith(1)
    await userEvent.click(screen.getByText(i18n.t('card.delete')))
    expect(onDelete).toHaveBeenCalledWith(1)
  })
})
