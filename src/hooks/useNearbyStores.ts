import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { fetchNearbyStores } from '../api/overpass'
import type { Coordinates, NearbyStore, RawNearbyStore, ShopType } from '../utils/types'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number): number => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// The range slider's fixed bounds — min is always "from where you are"
// (0m), max is hard-capped at 40km. Both stay in meters regardless of the
// account's metric/imperial preference (see useUnitSystem) — that
// preference only affects how NearbyStores *displays* these numbers, not
// the values themselves or the Geoapify radius sent over the wire.
export const MIN_DISTANCE = 0
export const MAX_DISTANCE_CAP = 40_000
// Sensible default upper bound so the first search doesn't fetch a full
// 40km radius from Geoapify before the user has touched the slider.
export const DEFAULT_MAX_DISTANCE = 3000

export function useNearbyStores(
  coords: Coordinates | null,
  shopTypes: ShopType[],
  minDistance: number = MIN_DISTANCE,
  maxDistance: number = DEFAULT_MAX_DISTANCE,
  // NearbyStores now requests geolocation as soon as the tab opens (to
  // center the map), without that by itself spending a Geoapify request —
  // the actual search still only fires once the user presses "Buscar
  // tiendas cercanas". ChatView's own call never passes this, so it keeps
  // searching as soon as it has coords.
  enabled: boolean = true
): UseQueryResult<NearbyStore[], Error> {
  return useQuery<RawNearbyStore[], Error, NearbyStore[]>({
    // maxDistance doubles as the Geoapify request radius (see fetchNearbyStores
    // below), so — unlike minDistance, which only reslices already-fetched
    // data in `select` — it has to be part of the query key: a wider max
    // genuinely needs a new request to reach stores Geoapify didn't return
    // last time.
    queryKey: ['nearbyStores', coords?.lat, coords?.lng, shopTypes, maxDistance],
    queryFn: () => fetchNearbyStores(coords!, shopTypes, maxDistance),
    enabled: enabled && !!coords && shopTypes.length > 0,
    staleTime: 5 * 60 * 1000,
    select: (stores: RawNearbyStore[]): NearbyStore[] =>
      stores
        .map((s) => ({
          ...s,
          distance: haversine(coords!.lat, coords!.lng, s.lat, s.lon),
        }))
        // Geoapify's own circle filter already excludes anything past
        // maxDistance, but its great-circle math can disagree with our
        // Haversine calc by a meter or two right at the edge — keep this as
        // a safety net rather than trusting the API's cutoff exactly.
        .filter((s) => s.distance >= minDistance && s.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 25),
  })
}
