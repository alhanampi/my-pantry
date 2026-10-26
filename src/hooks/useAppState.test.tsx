import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppState, UNDO_WINDOW_MS } from './useAppState'
import { usePantry } from './usePantry'
import { downloadCsv } from '../utils/exportCsv'
import { shoppingListToPdf } from '../utils/exportPdf'
import '../i18n'

vi.mock('./usePantry')
vi.mock('../utils/exportCsv', () => ({
  productsToCsv: vi.fn(() => 'csv-content'),
  downloadCsv: vi.fn(),
}))
vi.mock('../utils/exportPdf', () => ({
  shoppingListToPdf: vi.fn(),
}))

const product = (overrides: Partial<{ id: number; name: string; quantity: string; brand: string }> = {}) => ({
  id: 1,
  name: 'Leche',
  quantity: '2',
  brand: 'La Serenísima',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
  preferredStoreName: '',
  ...overrides,
})

const shoppingItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ...product(),
  purchased: false,
  listId: 'list_1',
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

  describe('undo on delete', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('hides the product immediately but only deletes it once the undo window elapses', () => {
      const deleteProduct = mutationSpy()
      mockPantry({ products: [product({ id: 1 })], deleteProduct })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleDeleteProduct(1))

      // Hidden right away, not yet deleted.
      expect(result.current.products).toHaveLength(0)
      expect(deleteProduct.mutate).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(UNDO_WINDOW_MS)
      })

      expect(deleteProduct.mutate).toHaveBeenCalledWith(1, expect.anything())
    })

    it('undo restores the product and never calls delete', () => {
      const deleteProduct = mutationSpy()
      mockPantry({ products: [product({ id: 1 })], deleteProduct })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleDeleteProduct(1))
      expect(result.current.products).toHaveLength(0)

      act(() => result.current.snackbar.action?.onClick())

      expect(result.current.products).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(UNDO_WINDOW_MS)
      })

      expect(deleteProduct.mutate).not.toHaveBeenCalled()
    })

    it('handleQuantityChange at zero hides the product and defers the delete instead of updating it', () => {
      const deleteProduct = mutationSpy()
      const updateProduct = mutationSpy()
      mockPantry({ products: [product({ id: 1, quantity: '1' })], deleteProduct, updateProduct })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleQuantityChange(1, -1))

      expect(result.current.products).toHaveLength(0)
      expect(updateProduct.mutate).not.toHaveBeenCalled()
      expect(result.current.zeroQtyDialog.open).toBe(true)

      act(() => {
        vi.advanceTimersByTime(UNDO_WINDOW_MS)
      })

      expect(deleteProduct.mutate).toHaveBeenCalledWith(1, expect.anything())
    })

    it('hides the shopping item immediately but only deletes it once the undo window elapses', () => {
      const deleteShoppingItem = mutationSpy()
      mockPantry({ shoppingList: [shoppingItem({ id: 2 })], deleteShoppingItem })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleDeleteShoppingItem(2))

      expect(result.current.shoppingList).toHaveLength(0)
      expect(deleteShoppingItem.mutate).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(UNDO_WINDOW_MS)
      })

      expect(deleteShoppingItem.mutate).toHaveBeenCalledWith(2, expect.anything())
    })

    it('undo restores the shopping item and never calls delete', () => {
      const deleteShoppingItem = mutationSpy()
      mockPantry({ shoppingList: [shoppingItem({ id: 2 })], deleteShoppingItem })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleDeleteShoppingItem(2))
      expect(result.current.shoppingList).toHaveLength(0)

      act(() => result.current.snackbar.action?.onClick())

      expect(result.current.shoppingList).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(UNDO_WINDOW_MS)
      })

      expect(deleteShoppingItem.mutate).not.toHaveBeenCalled()
    })
  })

  describe('handleSendToPantry', () => {
    it('creates the product from the shopping item and, on success, deletes the shopping item', () => {
      const createProduct = mutationSpy()
      const deleteShoppingItem = mutationSpy()
      createProduct.mutate = vi.fn((_data, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
      const item = shoppingItem({ id: 3, name: 'Fideos', purchased: true })
      mockPantry({ shoppingList: [item], createProduct, deleteShoppingItem })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleSendToPantry(3))

      expect(createProduct.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Fideos', quantity: '2', brand: 'La Serenísima' }),
        expect.anything()
      )
      // purchased/listId must not leak into the created product payload.
      const [payload] = createProduct.mutate.mock.calls[0]
      expect(payload).not.toHaveProperty('purchased')
      expect(payload).not.toHaveProperty('listId')
      expect(deleteShoppingItem.mutate).toHaveBeenCalledWith(3, expect.anything())
    })

    it('does nothing if the item is not found', () => {
      const createProduct = mutationSpy()
      mockPantry({ shoppingList: [], createProduct })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleSendToPantry(999))

      expect(createProduct.mutate).not.toHaveBeenCalled()
    })
  })

  describe('exports', () => {
    it('handleExportPantryCsv downloads a CSV of the current products', () => {
      mockPantry({ products: [product({ id: 1 })] })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleExportPantryCsv())

      expect(downloadCsv).toHaveBeenCalledWith(expect.any(String), 'csv-content')
    })

    it('handleExportShoppingPdf builds a PDF of the current shopping list', () => {
      mockPantry({ shoppingList: [shoppingItem({ id: 1 })] })
      const { result } = renderHook(() => useAppState())

      act(() => result.current.handleExportShoppingPdf())

      expect(shoppingListToPdf).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        'General'
      )
    })
  })
})
