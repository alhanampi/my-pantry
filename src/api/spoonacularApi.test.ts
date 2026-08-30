import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findRecipesByIngredients } from './spoonacularApi'

describe('spoonacularApi (findRecipesByIngredients)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('VITE_SPOONACULAR_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns an empty array without calling fetch when there are no ingredients', async () => {
    const result = await findRecipesByIngredients([])
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns the parsed recipes on success', async () => {
    const recipes = [{ id: 1, title: 'Pasta', image: '', usedIngredientCount: 1, missedIngredientCount: 0, usedIngredients: [], missedIngredients: [], likes: 0 }]
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(recipes), { status: 200 }))

    const result = await findRecipesByIngredients(['pasta'])

    expect(result).toEqual(recipes)
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('ingredients=pasta')
    expect(String(url)).toContain('apiKey=test-key')
  })

  it('throws quotaExceeded on a 402', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 402 }))
    await expect(findRecipesByIngredients(['pasta'])).rejects.toThrow('spoonacular.quotaExceeded')
  })

  it('throws invalidKey on a 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))
    await expect(findRecipesByIngredients(['pasta'])).rejects.toThrow('spoonacular.invalidKey')
  })

  it('throws a generic error on any other non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(findRecipesByIngredients(['pasta'])).rejects.toThrow('spoonacular.error')
  })

  it('throws when the API key env var is missing', async () => {
    vi.stubEnv('VITE_SPOONACULAR_KEY', '')
    await expect(findRecipesByIngredients(['pasta'])).rejects.toThrow('Missing VITE_SPOONACULAR_KEY')
  })
})
