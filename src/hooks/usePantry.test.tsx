import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePantry } from './usePantry'
import { guestStorage } from './useGuestStorage'
import * as pantryApi from '../api/pantryApi'

vi.mock('../api/pantryApi')
vi.mock('./useGuestStorage', () => ({
  guestStorage: {
    getProducts: vi.fn(() => []),
    getShopping: vi.fn(() => []),
    createProduct: vi.fn(),
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
    mockUseAuth.mockReturnValue({ isSignedIn: true, getToken: vi.fn().mockResolvedValue('token-123') })
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
    mockUseAuth.mockReturnValue({ isSignedIn: false, getToken: vi.fn() })
    const guestProduct = { id: 2, name: 'Arroz', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    vi.mocked(guestStorage.createProduct).mockReturnValue(guestProduct)

    const { result } = renderHook(() => usePantry(), { wrapper })

    await act(async () => {
      await result.current.createProduct.mutateAsync(guestProduct)
    })

    expect(guestStorage.createProduct).toHaveBeenCalledWith(guestProduct)
    expect(pantryApi.apiCreateProduct).not.toHaveBeenCalled()
  })
})
