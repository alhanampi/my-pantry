import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchNearbyStores } from './overpass'

describe('overpass (fetchNearbyStores)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('builds the Geoapify request and maps features to RawNearbyStore', async () => {
    const geoResponse = {
      features: [
        { properties: { place_id: '1', name: 'Coto', categories: ['commercial.supermarket'], lon: -58.4, lat: -34.6 } },
        { properties: { place_id: '2', categories: ['commercial.supermarket'], lon: 0, lat: 0 } }, // no name, filtered out
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(geoResponse), { status: 200 }))

    const result = await fetchNearbyStores({ lat: -34.6, lng: -58.4 }, ['supermarket'], 3000)

    expect(result).toEqual([{ id: '1', name: 'Coto', type: 'supermarket', lat: -34.6, lon: -58.4 }])
    const [url] = vi.mocked(fetch).mock.calls[0]
    const decoded = decodeURIComponent(String(url))
    expect(decoded).toContain('circle:-58.4,-34.6,3000')
    expect(decoded).toContain('proximity:-58.4,-34.6')
  })

  it('throws geoapify_unavailable when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }))
    await expect(fetchNearbyStores({ lat: 0, lng: 0 }, ['supermarket'], 3000)).rejects.toThrow(
      'geoapify_unavailable',
    )
  })

  it('passes the given radius through to the circle filter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ features: [] }), { status: 200 }))

    await fetchNearbyStores({ lat: -34.6, lng: -58.4 }, ['supermarket'], 40000)

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(decodeURIComponent(String(url))).toContain('circle:-58.4,-34.6,40000')
  })
})
