import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePantry } from './usePantry'
import { guestStorage } from './useGuestStorage'
import * as pantryApi from '../api/pantryApi'
import type { Product } from '../utils/types'

vi.mock('../api/pantryApi')
vi.mock('./useGuestStorage', () => ({
  guestStorage: {
    getProducts: vi.fn(() => []),
    getShopping: vi.fn(() => []),
    getShoppingLists: vi.fn(() => [{ id: 'guest-general', name: 'General', ownerId: 'guest', isGeneral: true, createdAt: '' }]),
    createProduct: vi.fn(),
    createShoppingItem: vi.fn(),
    createShoppingList: vi.fn(),
  },
}))

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('usePantry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authenticated: createProduct calls the API and invalidates the products query', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue('token-123') })
    const createdProduct = { id: 1, name: 'Leche', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    vi.mocked(pantryApi.apiCreateProduct).mockResolvedValue(createdProduct)
    vi.mocked(pantryApi.apiGetProducts).mockResolvedValue([])
    vi.mocked(pantryApi.apiGetShoppingItems).mockResolvedValue([])

    const { result } = renderHook(() => usePantry(), { wrapper })

    await act(async () => {
      await result.current.createProduct.mutateAsync(createdProduct)
    })

    expect(pantryApi.apiCreateProduct).toHaveBeenCalledWith('token-123', createdProduct)
    expect(guestStorage.createProduct).not.toHaveBeenCalled()
    await waitFor(() => expect(pantryApi.apiGetProducts).toHaveBeenCalled())
  })

  it('guest mode: createProduct writes to guestStorage instead of calling the API', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: vi.fn() })
    const guestProduct = { id: 2, name: 'Arroz', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    vi.mocked(guestStorage.createProduct).mockReturnValue(guestProduct)

    const { result } = renderHook(() => usePantry(), { wrapper })

    await act(async () => {
      await result.current.createProduct.mutateAsync(guestProduct)
    })

    expect(guestStorage.createProduct).toHaveBeenCalledWith(guestProduct)
    expect(pantryApi.apiCreateProduct).not.toHaveBeenCalled()
  })

  it('authenticated: isLoading stays true while the first fetch is in flight, instead of flashing an empty list', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue('token-123') })
    let resolveProducts!: (products: Product[]) => void
    vi.mocked(pantryApi.apiGetProducts).mockReturnValue(
      new Promise((resolve) => {
        resolveProducts = resolve
      })
    )
    vi.mocked(pantryApi.apiGetShoppingItems).mockResolvedValue([])

    const { result } = renderHook(() => usePantry(), { wrapper })

    // The fetch hasn't resolved yet — this is the exact bug: isLoading used
    // to be false here (because of the guest-storage initialData seed), so
    // the empty `products` array below would render as "pantry is empty"
    // instead of the loading skeleton.
    expect(result.current.isLoading).toBe(true)
    expect(result.current.products).toEqual([])

    await act(async () => {
      resolveProducts([])
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('guest mode: shows guestStorage data immediately with no loading state', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: vi.fn() })
    const guestProducts = [{ id: 3, name: 'Yerba', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }]
    vi.mocked(guestStorage.getProducts).mockReturnValue(guestProducts)

    const { result } = renderHook(() => usePantry(), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.products).toEqual(guestProducts)
    expect(pantryApi.apiGetProducts).not.toHaveBeenCalled()
  })
})
