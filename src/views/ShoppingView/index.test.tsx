import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingView from './index'
import { renderWithProviders } from '../../test/test-utils'
import '../../i18n'
import i18n from '../../i18n'
import type { ShoppingListItem } from '../../utils/types'

const item = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  id: 1,
  name: 'Arroz',
  quantity: '1',
  brand: '',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
  purchased: false,
  listId: 'list_1',
  ...overrides,
})

const baseProps = {
  items: [] as ShoppingListItem[],
  onAddClick: vi.fn(),
  onToggle: vi.fn(),
  onDelete: vi.fn(),
  onEdit: vi.fn(),
  onClearPurchased: vi.fn(),
  onQuantityChange: vi.fn(),
}

describe('ShoppingView', () => {
  it('shows the empty state when there are no items', () => {
    renderWithProviders(<ShoppingView {...baseProps} />)
    expect(screen.getByText(i18n.t('shopping.emptyTitle'))).toBeInTheDocument()
  })

  it('lists pending and purchased items separately', () => {
    renderWithProviders(<ShoppingView {...baseProps} items={[item({ id: 1, name: 'Arroz' }), item({ id: 2, name: 'Leche', purchased: true })]} />)
    expect(screen.getByText('Arroz')).toBeInTheDocument()
    expect(screen.getByText('Leche')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('shopping.purchased'))).toBeInTheDocument()
  })

  it('shows the clear-purchased button only when there are purchased items, and calls the handler', async () => {
    const onClearPurchased = vi.fn()
    renderWithProviders(
      <ShoppingView {...baseProps} items={[item({ purchased: true })]} onClearPurchased={onClearPurchased} />
    )
    await userEvent.click(screen.getByText(i18n.t('shopping.clearPurchased')))
    expect(onClearPurchased).toHaveBeenCalledOnce()
  })

  it('calls onAddClick from the add button', async () => {
    const onAddClick = vi.fn()
    renderWithProviders(<ShoppingView {...baseProps} onAddClick={onAddClick} />)
    await userEvent.click(screen.getByText(i18n.t('shopping.addProduct')))
    expect(onAddClick).toHaveBeenCalledOnce()
  })
})
