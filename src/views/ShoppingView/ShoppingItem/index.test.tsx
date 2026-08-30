import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingItem from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { ShoppingListItem } from '../../../utils/types'

const item: ShoppingListItem = {
  id: 1,
  name: 'Arroz',
  quantity: '1',
  brand: 'Gallo',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
  purchased: false,
}

describe('ShoppingItem', () => {
  it('renders the item name', () => {
    render(<ShoppingItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} onQuantityChange={vi.fn()} />)
    expect(screen.getByText('Arroz')).toBeInTheDocument()
  })

  it('calls onToggle when the checkbox is clicked', async () => {
    const onToggle = vi.fn()
    render(<ShoppingItem item={item} onToggle={onToggle} onDelete={vi.fn()} onEdit={vi.fn()} onQuantityChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('calls onEdit and onDelete from their icon buttons', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<ShoppingItem item={item} onToggle={vi.fn()} onDelete={onDelete} onEdit={onEdit} onQuantityChange={vi.fn()} />)

    await userEvent.click(screen.getByLabelText(i18n.t('card.edit')))
    expect(onEdit).toHaveBeenCalledWith(1)

    await userEvent.click(screen.getByLabelText(i18n.t('shopping.deleteItem')))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('calls onQuantityChange via the stepper', async () => {
    const onQuantityChange = vi.fn()
    render(<ShoppingItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} onQuantityChange={onQuantityChange} />)
    await userEvent.click(screen.getByLabelText('increase quantity'))
    expect(onQuantityChange).toHaveBeenCalledWith(1, 1)
  })

  it('expands to show details', async () => {
    render(<ShoppingItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} onQuantityChange={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('expand'))
    expect(screen.getByText(i18n.t('card.brand'))).toBeInTheDocument()
  })
})
