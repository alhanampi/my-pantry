import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductRow from './index'
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
  details: '',
}

describe('ProductRow', () => {
  it('renders product fields', () => {
    render(<ProductRow product={product} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={vi.fn()} onQuantityChange={vi.fn()} />)
    expect(screen.getByText('Leche')).toBeInTheDocument()
    expect(screen.getByText('La Serenísima')).toBeInTheDocument()
    expect(screen.getByText('Heladera')).toBeInTheDocument()
  })

  it('shows an em dash for missing brand/location', () => {
    render(<ProductRow product={{ ...product, brand: '', location: '' }} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={vi.fn()} onQuantityChange={vi.fn()} />)
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('calls onAddToCart, onEdit, and onDelete from their icon buttons', async () => {
    const onAddToCart = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<ProductRow product={product} onDelete={onDelete} onEdit={onEdit} onAddToCart={onAddToCart} onQuantityChange={vi.fn()} />)

    await userEvent.click(screen.getByLabelText(i18n.t('card.addToCart')))
    expect(onAddToCart).toHaveBeenCalledWith(product)

    await userEvent.click(screen.getByLabelText(`${i18n.t('card.edit')} Leche`))
    expect(onEdit).toHaveBeenCalledWith(1)

    await userEvent.click(screen.getByLabelText(`${i18n.t('card.delete')} Leche`))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('calls onQuantityChange via the stepper', async () => {
    const onQuantityChange = vi.fn()
    render(<ProductRow product={product} onDelete={vi.fn()} onEdit={vi.fn()} onAddToCart={vi.fn()} onQuantityChange={onQuantityChange} />)
    await userEvent.click(screen.getByLabelText('decrease quantity'))
    expect(onQuantityChange).toHaveBeenCalledWith(1, -1)
  })
})
