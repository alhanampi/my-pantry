import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchRecipesWithFallback } from './spoonacular'

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

  it('relaxes the criteria step by step until a non-empty result comes back', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([])) // full criteria — nothing
      .mockResolvedValueOnce(jsonResponse([])) // drop maxReadyTime/cuisine — still nothing
      .mockResolvedValueOnce(jsonResponse([{ id: 2, title: 'Rice bowl' }])) // single term + diet — hit

    const result = await searchRecipesWithFallback(
      { query: 'grilled chicken', cuisine: 'mexican', includeIngredients: 'rice', maxReadyTime: 15 },
      3,
    )

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('falls all the way through to an unfiltered search when everything else is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ id: 3, title: 'Surprise me' }]))

    const result = await searchRecipesWithFallback({ query: 'something obscure' }, 3)

    expect(result.results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(4)
    const lastCallUrl = mockFetch.mock.calls[3][0] as string
    expect(lastCallUrl).not.toContain('query=')
  })

  it('returns an empty result (not throw) if even the unfiltered attempt is empty', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))

    const result = await searchRecipesWithFallback({ query: 'nonexistent' }, 3)

    expect(result.results).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(4)
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
