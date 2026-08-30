import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useNearbyStores } from './useNearbyStores'
import { fetchNearbyStores } from '../api/overpass'
import { createTestQueryClient } from '../test/test-utils'
import type { RawNearbyStore } from '../utils/types'

vi.mock('../api/overpass')

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = createTestQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useNearbyStores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch when coords are null', () => {
    renderHook(() => useNearbyStores(null, ['supermarket']), { wrapper })
    expect(fetchNearbyStores).not.toHaveBeenCalled()
  })

  it('does not fetch when no shop types are selected', () => {
    renderHook(() => useNearbyStores({ lat: 0, lng: 0 }, []), { wrapper })
    expect(fetchNearbyStores).not.toHaveBeenCalled()
  })

  it('fetches and sorts results by distance ascending', async () => {
    const raw: RawNearbyStore[] = [
      { id: 'far', name: 'Far store', type: 'supermarket', lat: 1, lon: 1 },
      { id: 'near', name: 'Near store', type: 'supermarket', lat: 0.001, lon: 0.001 },
    ]
    vi.mocked(fetchNearbyStores).mockResolvedValue(raw)

    const { result } = renderHook(() => useNearbyStores({ lat: 0, lng: 0 }, ['supermarket']), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.map((s) => s.id)).toEqual(['near', 'far'])
    expect(result.current.data?.[0].distance).toBeLessThan(result.current.data?.[1].distance ?? Infinity)
  })
})
