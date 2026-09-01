import type { RecipeDetail, RecipeSearchFilters, RecipeSearchResponse, FavoriteRecipesResponse } from '../utils/types'
import {
  getCached,
  setCached,
  searchCacheKey,
  detailCacheKey,
  SEARCH_CACHE_TTL_MS,
  DETAIL_CACHE_TTL_MS,
} from '../utils/recipeCache'

const API_URL = import.meta.env.VITE_API_URL ?? ''

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'Server error')
  }
  return res.json() as Promise<T>
}

// NOTE — deliberate exception to docs/data-fetching.md's "token as first
// parameter" convention: /api/recipes is a public, unauthenticated endpoint
// (browsing works for guests too), so there is no token to pass. See the
// note added to docs/data-fetching.md.

// Cache-first, with a stale-on-error fallback: Spoonacular's free-tier quota
// is easy to exhaust (each search/detail call spends it), so identical
// requests are served from localStorage instead of hitting the network, and
// a live failure (typically 'quotaExceeded') falls back to a stale cached
// value rather than surfacing an error, if one exists. See ROADMAP.md's
// Recipes tab entry for why this replaced the earlier "no caching, Spoonacular
// is always the source of truth" decision.

export async function apiSearchRecipes(
  filters: RecipeSearchFilters,
  offset: number,
  lang: string,
): Promise<RecipeSearchResponse> {
  const cacheKey = searchCacheKey(filters as unknown as Record<string, string | undefined>, offset, lang)
  const cached = getCached<RecipeSearchResponse>(cacheKey, SEARCH_CACHE_TTL_MS)
  if (cached && !cached.stale) return cached.value

  const params = new URLSearchParams({ offset: String(offset), lang })
  if (filters.query) params.set('query', filters.query)
  if (filters.cuisine) params.set('cuisine', filters.cuisine)
  if (filters.diet) params.set('diet', filters.diet)
  if (filters.includeIngredients) params.set('includeIngredients', filters.includeIngredients)
  if (filters.maxCalories) params.set('maxCalories', filters.maxCalories)

  try {
    const res = await fetch(`${API_URL}/api/recipes/search?${params.toString()}`)
    const result = await handleResponse<RecipeSearchResponse>(res)
    setCached(cacheKey, result)
    return result
  } catch (err) {
    if (cached) {
      console.warn('Spoonacular search failed, serving stale cached results', err)
      return cached.value
    }
    throw err
  }
}

export async function apiGetRecipeDetail(id: number, lang: string): Promise<RecipeDetail> {
  const cacheKey = detailCacheKey(id, lang)
  const cached = getCached<RecipeDetail>(cacheKey, DETAIL_CACHE_TTL_MS)
  if (cached && !cached.stale) return cached.value

  try {
    const res = await fetch(`${API_URL}/api/recipes/${id}?lang=${lang}`)
    const json = await handleResponse<{ recipe: RecipeDetail }>(res)
    setCached(cacheKey, json.recipe)
    return json.recipe
  } catch (err) {
    if (cached) {
      console.warn('Spoonacular recipe detail failed, serving stale cached recipe', err)
      return cached.value
    }
    throw err
  }
}

// ── Favorites — per-user data, so these DO take a token (unlike the two
// public calls above). ─────────────────────────────────────────────────────

export async function apiGetFavoriteIds(token: string): Promise<number[]> {
  const res = await fetch(`${API_URL}/api/recipes/favorites/ids`, { headers: headers(token) })
  const json = await handleResponse<{ ids: number[] }>(res)
  return json.ids
}

export async function apiGetFavoriteRecipes(token: string, lang: string): Promise<FavoriteRecipesResponse> {
  const res = await fetch(`${API_URL}/api/recipes/favorites?lang=${lang}`, { headers: headers(token) })
  return handleResponse<FavoriteRecipesResponse>(res)
}

export async function apiAddFavorite(token: string, recipeId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/recipes/favorites`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ recipeId }),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiRemoveFavorite(token: string, recipeId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/recipes/favorites/${recipeId}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}
