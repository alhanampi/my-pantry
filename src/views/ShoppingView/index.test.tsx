import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingView from './index'
import { renderWithProviders } from '../../test/test-utils'
import '../../i18n'
import i18n from '../../i18n'
import type { ShoppingListItem } from '../../utils/types'

// ShoppingView renders NearbyStores, which reads the account's
// metric/imperial preference — mock it out here too so this file doesn't
// need a real ClerkProvider just to satisfy useUnitSystem's useAuth() call.
vi.mock('../../hooks/useUnitSystem', () => ({
  useUnitSystem: () => ({ unitSystem: 'metric' as const, setUnitSystem: vi.fn(), isPending: false }),
}))
vi.mock('../../hooks/useFavoriteStores', () => ({
  useFavoriteStoreIds: () => ({ data: [] }),
  useToggleFavoriteStore: () => ({ mutate: vi.fn(), isPending: false }),
}))
const mockFavoriteListIds = vi.fn((): { data: string[] } => ({ data: [] }))
const mockToggleFavoriteListMutate = vi.fn()
vi.mock('../../hooks/useFavoriteShoppingLists', () => ({
  useFavoriteShoppingListIds: () => mockFavoriteListIds(),
  useToggleFavoriteShoppingList: () => ({ mutate: mockToggleFavoriteListMutate, isPending: false }),
}))

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
  onSendToPantry: vi.fn(),
  onExportPdf: vi.fn(),
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

  it('hides the delete-list button for the General list', () => {
    renderWithProviders(
      <ShoppingView
        {...baseProps}
        lists={[{ id: 'l1', name: 'General', ownerId: 'u1', isGeneral: true, createdAt: '' }]}
        selectedListId="l1"
        onDeleteListClick={vi.fn()}
      />,
    )
    expect(screen.queryByText(i18n.t('shopping.deleteList'))).not.toBeInTheDocument()
  })

  it('shows the delete-list button for a non-General list and calls the handler', async () => {
    const onDeleteListClick = vi.fn()
    renderWithProviders(
      <ShoppingView
        {...baseProps}
        lists={[
          { id: 'l1', name: 'General', ownerId: 'u1', isGeneral: true, createdAt: '' },
          { id: 'l2', name: 'Party', ownerId: 'u1', isGeneral: false, createdAt: '' },
        ]}
        selectedListId="l2"
        onDeleteListClick={onDeleteListClick}
      />,
    )
    await userEvent.click(screen.getByText(i18n.t('shopping.deleteList')))
    expect(onDeleteListClick).toHaveBeenCalledOnce()
  })

  it('shows the export-PDF button only when there are items, and calls the handler', async () => {
    const onExportPdf = vi.fn()
    renderWithProviders(<ShoppingView {...baseProps} items={[item()]} onExportPdf={onExportPdf} />)
    await userEvent.click(screen.getByText(i18n.t('shopping.exportPdf')))
    expect(onExportPdf).toHaveBeenCalledOnce()
  })

  it('favorites the currently selected list from the heart next to the selector', async () => {
    renderWithProviders(
      <ShoppingView
        {...baseProps}
        lists={[
          { id: 'l1', name: 'General', ownerId: 'u1', isGeneral: true, createdAt: '' },
          { id: 'l2', name: 'Party', ownerId: 'u1', isGeneral: false, createdAt: '' },
        ]}
        selectedListId="l2"
        onSelectList={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByLabelText(i18n.t('shopping.addFavoriteList')))

    expect(mockToggleFavoriteListMutate).toHaveBeenCalledWith({ listId: 'l2', isFavorite: false })
  })

  it('shows the remove-favorite label when the selected list is already favorited', () => {
    mockFavoriteListIds.mockReturnValueOnce({ data: ['l2'] })
    renderWithProviders(
      <ShoppingView
        {...baseProps}
        lists={[{ id: 'l2', name: 'Party', ownerId: 'u1', isGeneral: false, createdAt: '' }]}
        selectedListId="l2"
        onSelectList={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(i18n.t('shopping.removeFavoriteList'))).toBeInTheDocument()
  })
})
