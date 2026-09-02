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

// Default matches the fixed 3km radius already requested from Geoapify in
// fetchNearbyStores — i.e. "no filter", every fetched result passes. Not
// part of the query key on purpose: maxDistance only reslices already-fetched
// data (via `select`), it never needs a refetch on its own.
export const DEFAULT_MAX_DISTANCE = 3000

export function useNearbyStores(
  coords: Coordinates | null,
  shopTypes: ShopType[],
  maxDistance: number = DEFAULT_MAX_DISTANCE
): UseQueryResult<NearbyStore[], Error> {
  return useQuery<RawNearbyStore[], Error, NearbyStore[]>({
    queryKey: ['nearbyStores', coords?.lat, coords?.lng, shopTypes],
    queryFn: () => fetchNearbyStores(coords!, shopTypes),
    enabled: !!coords && shopTypes.length > 0,
    staleTime: 5 * 60 * 1000,
    select: (stores: RawNearbyStore[]): NearbyStore[] =>
      stores
        .map((s) => ({
          ...s,
          distance: haversine(coords!.lat, coords!.lng, s.lat, s.lon),
        }))
        .filter((s) => s.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 25),
  })
}
