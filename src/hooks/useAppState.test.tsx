import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppState } from './useAppState'
import { usePantry } from './usePantry'
import '../i18n'

vi.mock('./usePantry')

const product = (overrides: Partial<{ id: number; name: string; quantity: string; brand: string }> = {}) => ({
  id: 1,
  name: 'Leche',
  quantity: '2',
  brand: 'La Serenísima',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
  ...overrides,
})

function mutationSpy() {
  return { mutate: vi.fn(), isPending: false }
}

function mockPantry(overrides: Record<string, unknown> = {}) {
  vi.mocked(usePantry).mockReturnValue({
    products: [],
    shoppingList: [],
    shoppingLists: [{ id: 'list_1', name: 'General', ownerId: 'user_1', isGeneral: true, createdAt: '' }],
    activeListId: 'list_1',
    isLoading: false,
    createProduct: mutationSpy(),
    updateProduct: mutationSpy(),
    deleteProduct: mutationSpy(),
    createShoppingItem: mutationSpy(),
    updateShoppingItem: mutationSpy(),
    deleteShoppingItem: mutationSpy(),
    clearPurchasedItems: mutationSpy(),
    createShoppingList: mutationSpy(),
    sendRecipeToShoppingList: mutationSpy(),
    ...overrides,
  } as unknown as ReturnType<typeof usePantry>)
}

describe('useAppState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters products by search query across name/brand/location', () => {
    mockPantry({ products: [product({ id: 1, name: 'Leche' }), product({ id: 2, name: 'Arroz', brand: 'Gallo' })] })
    const { result } = renderHook(() => useAppState())

    act(() => result.current.setSearchQuery('gallo'))

    expect(result.current.products.map((p) => p.id)).toEqual([2])
  })

  it('sorts products and toggles direction on repeated sort by the same key', () => {
    mockPantry({ products: [product({ id: 1, name: 'Zanahoria' }), product({ id: 2, name: 'Arroz' })] })
    const { result } = renderHook(() => useAppState())

    act(() => result.current.handleSort('name'))
    expect(result.current.products.map((p) => p.id)).toEqual([2, 1]) // Arroz, Zanahoria (asc)

    act(() => result.current.handleSort('name'))
    expect(result.current.products.map((p) => p.id)).toEqual([1, 2]) // desc
  })

  it('openAddModal opens in the context of the current view', () => {
    mockPantry()
    const { result } = renderHook(() => useAppState())

    act(() => result.current.handleViewChange('shopping'))
    act(() => result.current.openAddModal())

    expect(result.current.addModal).toEqual({ open: true, context: 'shopping' })
  })

  it('handleQuantityChange at zero opens the zero-quantity dialog and deletes the product instead of updating it', () => {
    const deleteProduct = mutationSpy()
    const updateProduct = mutationSpy()
    mockPantry({ products: [product({ id: 1, quantity: '1' })], deleteProduct, updateProduct })
    const { result } = renderHook(() => useAppState())

    act(() => result.current.handleQuantityChange(1, -1))

    expect(deleteProduct.mutate).toHaveBeenCalledWith(1, expect.anything())
    expect(updateProduct.mutate).not.toHaveBeenCalled()
    expect(result.current.zeroQtyDialog.open).toBe(true)
  })

  it('handleAddToCart creates a new shopping item when none exists yet', () => {
    const createShoppingItem = mutationSpy()
    mockPantry({ products: [product()], shoppingList: [], createShoppingItem })
    const { result } = renderHook(() => useAppState())

    act(() => result.current.handleAddToCart(product()))

    expect(createShoppingItem.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Leche', purchased: false })
    )
  })

  it('handleAddToCart merges quantity into an existing shopping item with the same name', () => {
    const updateShoppingItem = mutationSpy()
    const existing = { ...product({ id: 5 }), purchased: false, quantity: '3' }
    mockPantry({ shoppingList: [existing], updateShoppingItem })
    const { result } = renderHook(() => useAppState())

    act(() => result.current.handleAddToCart(product({ quantity: '2' })))

    expect(updateShoppingItem.mutate).toHaveBeenCalledWith({ id: 5, data: { quantity: '5' } })
  })
})
