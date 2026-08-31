import type { RecipeDetail, RecipeSearchFilters, RecipeSearchResponse } from '../utils/types'

const API_URL = import.meta.env.VITE_API_URL ?? ''

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

export async function apiSearchRecipes(
  filters: RecipeSearchFilters,
  offset: number,
  lang: string,
): Promise<RecipeSearchResponse> {
  const params = new URLSearchParams({ offset: String(offset), lang })
  if (filters.query) params.set('query', filters.query)
  if (filters.cuisine) params.set('cuisine', filters.cuisine)
  if (filters.diet) params.set('diet', filters.diet)
  if (filters.includeIngredients) params.set('includeIngredients', filters.includeIngredients)
  if (filters.maxCalories) params.set('maxCalories', filters.maxCalories)

  const res = await fetch(`${API_URL}/api/recipes/search?${params.toString()}`)
  return handleResponse<RecipeSearchResponse>(res)
}

export async function apiGetRecipeDetail(id: number, lang: string): Promise<RecipeDetail> {
  const res = await fetch(`${API_URL}/api/recipes/${id}?lang=${lang}`)
  const json = await handleResponse<{ recipe: RecipeDetail }>(res)
  return json.recipe
}
