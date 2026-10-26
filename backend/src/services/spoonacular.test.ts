import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchRecipesWithFallback, searchRecipeByTitle } from './spoonacular'

// searchRecipesWithFallback drives real fetch calls (via searchRecipes) —
// mocking fetch directly here (rather than mocking searchRecipes itself)
// exercises the actual progressive-relaxation logic end to end.
const mockFetch = vi.fn()

function jsonResponse(results: unknown[]) {
  return {
    status: 200,
    ok: true,
    json: async () => ({ results, offset: 0, number: 3, totalResults: results.length }),
  }
}

describe('searchRecipesWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    process.env.SPOONACULAR_KEY = 'test-key'
  })

  it('returns the first attempt straight away when it already has results', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, title: 'Grilled chicken' }]))

    const result = await searchRecipesWithFallback(
      { query: 'grilled chicken', includeIngredients: 'chicken', maxReadyTime: 20, diet: 'vegan' },
      3,
    )

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('relaxes the time window, then ingredients, while keeping cuisine as long as possible', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([])) // full criteria — nothing
      .mockResolvedValueOnce(jsonResponse([])) // drop maxReadyTime (still cuisine+query+ingredients) — nothing
      .mockResolvedValueOnce(jsonResponse([{ id: 2, title: 'Rice bowl' }])) // drop ingredients too, keep cuisine+query — hit

    const result = await searchRecipesWithFallback(
      { query: 'grilled chicken', cuisine: 'mexican', includeIngredients: 'rice', maxReadyTime: 15 },
      3,
    )

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const hitCallUrl = mockFetch.mock.calls[2][0] as string
    expect(hitCallUrl).toContain('cuisine=mexican')
    expect(hitCallUrl).not.toContain('includeIngredients=')
  })

  it('falls all the way through to an unfiltered search when everything else is empty', async () => {
    // A query-only criteria object collapses several of the relaxation
    // steps into the exact same request (deduped — see pushUnique), so only
    // two genuinely distinct attempts exist: query-based, then unfiltered.
    mockFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ id: 3, title: 'Surprise me' }]))

    const result = await searchRecipesWithFallback({ query: 'something obscure' }, 3)

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const lastCallUrl = mockFetch.mock.calls[1][0] as string
    expect(lastCallUrl).not.toContain('query=')
  })

  it('returns an empty result (not throw) if even the unfiltered attempt is empty', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))

    const result = await searchRecipesWithFallback({ query: 'nonexistent' }, 3)

    expect(result.results).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('tries the cuisine alone BEFORE an unrelated ingredient-only match, not after', async () => {
    // This is the exact shape of the real bug report: a cuisine ("Middle
    // Eastern") paired with ingredients that also happen to match plenty of
    // totally unrelated dishes (e.g. "eggs, flour" matches scones). Cuisine
    // must get its own dedicated attempt before the ingredient-only step
    // ever runs, or an unrelated match wins first just because it's broader.
    mockFetch
      .mockResolvedValueOnce(jsonResponse([])) // full (cuisine + includeIngredients) — nothing
      .mockResolvedValueOnce(jsonResponse([{ id: 5, title: 'Baba ganoush' }])) // cuisine alone — hit

    const result = await searchRecipesWithFallback(
      { cuisine: 'Middle Eastern', includeIngredients: 'eggplant, flour, eggs' },
      3,
    )

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const hitCallUrl = mockFetch.mock.calls[1][0] as string
    expect(hitCallUrl).toContain('cuisine=Middle')
    expect(hitCallUrl).not.toContain('includeIngredients=')
  })

  it('handles an empty criteria object by going straight to the unfiltered search shape', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 4, title: 'Anything' }]))

    const result = await searchRecipesWithFallback({}, 3)

    expect(result.results).toHaveLength(1)
    const firstCallUrl = mockFetch.mock.calls[0][0] as string
    expect(firstCallUrl).not.toContain('query=')
    expect(firstCallUrl).not.toContain('includeIngredients=')
  })
})

describe('searchRecipeByTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    process.env.SPOONACULAR_KEY = 'test-key'
  })

  it('does not force sort=random, unlike searchRecipes', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, title: 'Grilled chicken', image: 'img.jpg' }]))

    await searchRecipeByTitle('Grilled chicken')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('query=Grilled')
    expect(calledUrl).not.toContain('sort=')
  })

  it('returns the first result', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, title: 'Grilled chicken', image: 'img.jpg' }]))
    const result = await searchRecipeByTitle('Grilled chicken')
    expect(result).toEqual(expect.objectContaining({ id: 1, image: 'img.jpg' }))
  })

  it('returns null when nothing matches', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))
    expect(await searchRecipeByTitle('Nonexistent dish')).toBeNull()
  })
})
