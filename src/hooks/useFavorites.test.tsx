import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useFavoriteToggle } from './useFavorites'
import * as recipesApi from '../api/recipesApi'

vi.mock('../api/recipesApi')
vi.mock('./useGuestStorage', () => ({
  guestStorage: {
    getFavoriteIds: vi.fn(() => []),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
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

describe('useFavoriteToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue('token-123') })
  })

  it('saves a favorite immediately, without going through pendingRemoveId', async () => {
    vi.mocked(recipesApi.apiAddFavorite).mockResolvedValue(undefined)
    const { result } = renderHook(() => useFavoriteToggle(), { wrapper })

    act(() => result.current.requestToggle(42, false))

    expect(result.current.pendingRemoveId).toBeNull()
    await waitFor(() => expect(recipesApi.apiAddFavorite).toHaveBeenCalledWith('token-123', 42))
    expect(recipesApi.apiRemoveFavorite).not.toHaveBeenCalled()
  })

  it('does not remove a favorite until confirmRemove is called', () => {
    const { result } = renderHook(() => useFavoriteToggle(), { wrapper })

    act(() => result.current.requestToggle(42, true))

    expect(result.current.pendingRemoveId).toBe(42)
    expect(recipesApi.apiRemoveFavorite).not.toHaveBeenCalled()
  })

  it('confirmRemove removes the pending favorite and clears pendingRemoveId', async () => {
    vi.mocked(recipesApi.apiRemoveFavorite).mockResolvedValue(undefined)
    const { result } = renderHook(() => useFavoriteToggle(), { wrapper })

    act(() => result.current.requestToggle(42, true))
    act(() => result.current.confirmRemove())

    expect(result.current.pendingRemoveId).toBeNull()
    await waitFor(() => expect(recipesApi.apiRemoveFavorite).toHaveBeenCalledWith('token-123', 42))
  })

  it('cancelRemove clears pendingRemoveId without removing anything', () => {
    const { result } = renderHook(() => useFavoriteToggle(), { wrapper })

    act(() => result.current.requestToggle(42, true))
    act(() => result.current.cancelRemove())

    expect(result.current.pendingRemoveId).toBeNull()
    expect(recipesApi.apiRemoveFavorite).not.toHaveBeenCalled()
  })
})
