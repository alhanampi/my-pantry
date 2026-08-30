import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGuestMigration } from './useGuestMigration'
import { guestStorage } from './useGuestStorage'
import * as pantryApi from '../api/pantryApi'
import { createTestQueryClient } from '../test/test-utils'
import { QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api/pantryApi')
vi.mock('./useGuestStorage', () => ({
  guestStorage: {
    getProducts: vi.fn(() => []),
    getShopping: vi.fn(() => []),
    removeMigratedItems: vi.fn(),
  },
}))

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = createTestQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useGuestMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue('token-123') })
  })

  it('is a no-op when there is nothing in guest storage', async () => {
    vi.mocked(guestStorage.getProducts).mockReturnValue([])
    vi.mocked(guestStorage.getShopping).mockReturnValue([])

    const { result } = renderHook(() => useGuestMigration(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(pantryApi.apiCreateProduct).not.toHaveBeenCalled()
    expect(guestStorage.removeMigratedItems).not.toHaveBeenCalled()
  })

  it('migrates what it can and surfaces an error when some items fail (Promise.allSettled)', async () => {
    const good = { id: 1, name: 'Leche', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    const bad = { id: 2, name: 'Roto', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    vi.mocked(guestStorage.getProducts).mockReturnValue([good, bad])
    vi.mocked(guestStorage.getShopping).mockReturnValue([])
    vi.mocked(pantryApi.apiCreateProduct).mockImplementation(async (_token, data) => {
      if (data.name === 'Roto') throw new Error('server error')
      return good
    })

    const { result } = renderHook(() => useGuestMigration(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('Some items could not be migrated')
    })

    // the successful item is still removed even though the other failed
    expect(guestStorage.removeMigratedItems).toHaveBeenCalledWith([good.id], [])
  })

  it('succeeds and invalidates queries when everything migrates', async () => {
    const good = { id: 1, name: 'Leche', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    vi.mocked(guestStorage.getProducts).mockReturnValue([good])
    vi.mocked(guestStorage.getShopping).mockReturnValue([])
    vi.mocked(pantryApi.apiCreateProduct).mockResolvedValue(good)

    const { result } = renderHook(() => useGuestMigration(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(guestStorage.removeMigratedItems).toHaveBeenCalledWith([good.id], [])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('throws when there is no auth token', async () => {
    vi.mocked(guestStorage.getProducts).mockReturnValue([{ id: 1, name: 'x', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }])
    vi.mocked(guestStorage.getShopping).mockReturnValue([])
    mockUseAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue(null) })

    const { result } = renderHook(() => useGuestMigration(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('Not authenticated')
    })
  })
})
