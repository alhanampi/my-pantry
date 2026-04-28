import type { Coordinates, RawNearbyStore, ShopType } from '../utils/types'

export const ALL_SHOP_TYPES: ShopType[] = [
  'supermarket',
  'grocery',
  'marketplace',
  'wholesale',
  'convenience',
  'greengrocer',
  'butcher',
  'seafood',
  'bakery',
  'deli',
  'cheese',
  'health_food',
  'organic',
]

export const DEFAULT_SHOP_TYPES: ShopType[] = ['supermarket', 'grocery', 'marketplace']

const CATEGORY_MAP: Record<ShopType, string> = {
  supermarket: 'commercial.supermarket',
  grocery:     'commercial.convenience',
  marketplace: 'commercial.marketplace',
  wholesale:   'commercial.wholesale',
  convenience: 'commercial.convenience',
  greengrocer: 'commercial.food_and_drink.fruit_and_vegetable',
  butcher:     'commercial.food_and_drink.butcher',
  seafood:     'commercial.food_and_drink.seafood',
  bakery:      'commercial.food_and_drink.bakery',
  deli:        'commercial.food_and_drink.deli',
  cheese:      'commercial.food_and_drink.cheese_and_dairy',
  health_food: 'commercial.food_and_drink.health_food',
  organic:     'commercial.food_and_drink.organic',
}

interface GeoapifyFeature {
  properties: {
    place_id: string
    name?: string
    categories: string[]
    lon: number
    lat: number
  }
}

interface GeoapifyResponse {
  features: GeoapifyFeature[]
}

export async function fetchNearbyStores(
  { lat, lng }: Coordinates,
  shopTypes: ShopType[]
): Promise<RawNearbyStore[]> {
  const apiKey = import.meta.env.VITE_GEOAPIFY_KEY as string
  const categories = [...new Set(shopTypes.map((t) => CATEGORY_MAP[t]))].join(',')

  const params = new URLSearchParams({
    categories,
    filter:  `circle:${lng},${lat},3000`,
    bias:    `proximity:${lng},${lat}`,
    limit:   '100',
    apiKey,
  })

  const res = await fetch(`https://api.geoapify.com/v2/places?${params}`)
  if (!res.ok) throw new Error('geoapify_unavailable')

  const json = (await res.json()) as GeoapifyResponse

  return json.features
    .filter((f) => Boolean(f.properties.name))
    .map((f) => ({
      id:   f.properties.place_id,
      name: f.properties.name!,
      type: f.properties.categories[0]?.split('.').slice(-1)[0] ?? '',
      lat:  f.properties.lat,
      lon:  f.properties.lon,
    }))
}
