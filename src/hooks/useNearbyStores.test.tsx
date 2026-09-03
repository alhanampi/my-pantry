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

    // Unbounded max since these two points are ~157km apart on purpose (just
    // to get a stable "near"/"far" ordering) — real distance filtering is
    // covered by the tests below.
    const { result } = renderHook(
      () => useNearbyStores({ lat: 0, lng: 0 }, ['supermarket'], 0, Infinity),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.map((s) => s.id)).toEqual(['near', 'far'])
    expect(result.current.data?.[0].distance).toBeLessThan(result.current.data?.[1].distance ?? Infinity)
  })

  it('filters out results beyond maxDistance', async () => {
    const raw: RawNearbyStore[] = [
      { id: 'far', name: 'Far store', type: 'supermarket', lat: 1, lon: 1 }, // ~157km away
      { id: 'near', name: 'Near store', type: 'supermarket', lat: 0.001, lon: 0.001 }, // ~157m away
    ]
    vi.mocked(fetchNearbyStores).mockResolvedValue(raw)

    const { result } = renderHook(
      () => useNearbyStores({ lat: 0, lng: 0 }, ['supermarket'], 0, 1000),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.map((s) => s.id)).toEqual(['near'])
  })

  it('filters out results closer than minDistance', async () => {
    const raw: RawNearbyStore[] = [
      { id: 'tooClose', name: 'Right next door', type: 'supermarket', lat: 0.0001, lon: 0.0001 }, // ~15m away
      { id: 'inRange', name: 'A block away', type: 'supermarket', lat: 0.003, lon: 0.003 }, // ~470m away
    ]
    vi.mocked(fetchNearbyStores).mockResolvedValue(raw)

    const { result } = renderHook(
      () => useNearbyStores({ lat: 0, lng: 0 }, ['supermarket'], 100, 3000),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.map((s) => s.id)).toEqual(['inRange'])
  })

  it('defaults to [0, DEFAULT_MAX_DISTANCE] and requests that radius from fetchNearbyStores', async () => {
    const raw: RawNearbyStore[] = [
      { id: 'a', name: 'Store A', type: 'supermarket', lat: 0.001, lon: 0.001 },
    ]
    vi.mocked(fetchNearbyStores).mockResolvedValue(raw)

    const { result } = renderHook(() => useNearbyStores({ lat: 0, lng: 0 }, ['supermarket']), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.map((s) => s.id)).toEqual(['a'])
    expect(fetchNearbyStores).toHaveBeenCalledWith({ lat: 0, lng: 0 }, ['supermarket'], 3000)
  })

  it('requests a wider radius from fetchNearbyStores when maxDistance grows', async () => {
    vi.mocked(fetchNearbyStores).mockResolvedValue([])

    renderHook(() => useNearbyStores({ lat: 0, lng: 0 }, ['supermarket'], 0, 40000), { wrapper })

    await waitFor(() => expect(fetchNearbyStores).toHaveBeenCalledWith({ lat: 0, lng: 0 }, ['supermarket'], 40000))
  })
})
