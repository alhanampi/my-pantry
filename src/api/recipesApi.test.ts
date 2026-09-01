import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiSearchRecipes, apiGetRecipeDetail } from './recipesApi'
import type { RecipeSearchFilters, RecipeSearchResponse, RecipeDetail } from '../utils/types'

const filters: RecipeSearchFilters = { query: 'pasta', cuisine: '', diet: '', includeIngredients: '', maxCalories: '' }

const searchResponse: RecipeSearchResponse = {
  results: [{ id: 1, title: 'Pasta', image: 'img', servings: 2, readyInMinutes: 20, ingredientNames: [], calories: 300 }],
  totalResults: 1,
  offset: 0,
  number: 4,
}

const detail: RecipeDetail = {
  id: 1,
  title: 'Pasta',
  image: 'img',
  servings: 2,
  readyInMinutes: 20,
  ingredients: [],
  instructions: [],
} as unknown as RecipeDetail

describe('recipesApi caching', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('apiSearchRecipes caches a successful response and serves it without a second fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(searchResponse), { status: 200 }))

    const first = await apiSearchRecipes(filters, 0, 'en')
    expect(first).toEqual(searchResponse)
    expect(fetch).toHaveBeenCalledTimes(1)

    const second = await apiSearchRecipes(filters, 0, 'en')
    expect(second).toEqual(searchResponse)
    expect(fetch).toHaveBeenCalledTimes(1) // served from cache, no new network call
  })

  it('apiSearchRecipes falls back to a stale cached value when the live call fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(searchResponse), { status: 200 }))
    await apiSearchRecipes(filters, 0, 'en')

    // Force the cached entry to look expired by rewriting it with an old savedAt.
    const key = Object.keys(localStorage).find((k) => k.startsWith('recipe_cache_search_v1_'))!
    const entry = JSON.parse(localStorage.getItem(key)!)
    localStorage.setItem(key, JSON.stringify({ ...entry, savedAt: 0 }))

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'quotaExceeded' }), { status: 503 }))
    const result = await apiSearchRecipes(filters, 0, 'en')
    expect(result).toEqual(searchResponse) // stale cache, not an error
  })

  it('apiSearchRecipes throws when the live call fails and nothing is cached', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'quotaExceeded' }), { status: 503 }))
    await expect(apiSearchRecipes(filters, 0, 'en')).rejects.toThrow('quotaExceeded')
  })

  it('apiGetRecipeDetail caches a successful response and serves it without a second fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ recipe: detail }), { status: 200 }))

    const first = await apiGetRecipeDetail(1, 'en')
    expect(first).toEqual(detail)
    expect(fetch).toHaveBeenCalledTimes(1)

    const second = await apiGetRecipeDetail(1, 'en')
    expect(second).toEqual(detail)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
