import type {
  Coordinates,
  OverpassResponse,
  OverpassElement,
  RawNearbyStore,
  ShopType,
} from '../utils/types'

export const ALL_SHOP_TYPES: ShopType[] = [
  'supermarket',
  'grocery',
  'convenience',
  'greengrocer',
  'butcher',
  'seafood',
  'bakery',
]

export const DEFAULT_SHOP_TYPES: ShopType[] = ['supermarket', 'grocery']

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export async function fetchNearbyStores(
  { lat, lng }: Coordinates,
  shopTypes: ShopType[]
): Promise<RawNearbyStore[]> {
  const typeFilter = shopTypes.join('|')
  const query = `[out:json][timeout:20];(node["shop"~"${typeFilter}"](around:3000,${lat},${lng});way["shop"~"${typeFilter}"](around:3000,${lat},${lng}););out center;`

  let elements: OverpassElement[] | null = null

  for (const url of MIRRORS) {
    try {
      const res = await fetch(`${url}?${new URLSearchParams({ data: query })}`)
      if (!res.ok) continue
      const json = (await res.json()) as OverpassResponse
      elements = json.elements
      break
    } catch {
      continue
    }
  }

  if (elements === null) throw new Error('overpass_unavailable')

  return elements
    .map((el: OverpassElement): RawNearbyStore | null => {
      const name = el.tags?.name ?? el.tags?.brand
      if (!name) return null
      const storeLat = el.type === 'node' ? el.lat : el.center?.lat
      const storeLon = el.type === 'node' ? el.lon : el.center?.lon
      if (!storeLat || !storeLon) return null
      return { id: el.id, name, type: el.tags?.shop ?? '', lat: storeLat, lon: storeLon }
    })
    .filter((s): s is RawNearbyStore => s !== null)
}
