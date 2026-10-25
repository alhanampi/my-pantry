export interface GeoLocation {
  lat: number
  lng: number
}

// Shared by chatAssistant.ts (recipe-search cuisine bias) and the Mealprep AI
// generator — same ad-hoc, non-persisted pattern as nearbyStoresSummary: the
// client sends raw browser geolocation per-request, nothing is stored on the
// User. Coordinates are rounded before reaching the prompt since the model
// only needs enough precision to infer a country/region, not an exact spot.
export function buildGeoHint(location?: GeoLocation): string | undefined {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return undefined
  if (Number.isNaN(location.lat) || Number.isNaN(location.lng)) return undefined

  return (
    `Approximate user location: latitude ${location.lat.toFixed(1)}, longitude ${location.lng.toFixed(1)}. ` +
    'Infer the likely country/region from these coordinates and bias recipe choices toward cuisines and ' +
    'ingredients that are locally common and easy to find there, instead of a random/generic selection.'
  )
}
