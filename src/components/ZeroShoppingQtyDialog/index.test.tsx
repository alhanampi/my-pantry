import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ZeroShoppingQtyDialog from './index'
import '../../i18n'

const item = { id: 1, name: 'Arroz', quantity: '0', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '', purchased: false, listId: 'list_1' }

describe('ZeroShoppingQtyDialog', () => {
  it('renders the item name when open', () => {
    render(<ZeroShoppingQtyDialog open item={item} onAction={vi.fn()} />)
    expect(screen.getByText(/Arroz/)).toBeInTheDocument()
  })

  it('calls onAction("delete") when the confirm button is clicked', async () => {
    const onAction = vi.fn()
    render(<ZeroShoppingQtyDialog open item={item} onAction={onAction} />)
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onAction).toHaveBeenCalledWith('delete')
  })

  it('calls onAction("cancel") when the cancel button is clicked', async () => {
    const onAction = vi.fn()
    render(<ZeroShoppingQtyDialog open item={item} onAction={onAction} />)
    await userEvent.click(screen.getAllByRole('button')[1])
    expect(onAction).toHaveBeenCalledWith('cancel')
  })
})
