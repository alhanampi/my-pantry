import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  searchEdamamRecipes,
  getEdamamRecipeInformation,
  EdamamConfigError,
  EdamamQuotaError,
  EdamamAuthError,
} from './edamam'

const mockFetch = vi.fn()

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

function hit(overrides: Record<string, unknown> = {}) {
  return { recipe: { uri: 'recipe_1', label: 'Milanesa', image: 'img.jpg', ...overrides } }
}

describe('searchEdamamRecipes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    process.env.EDAMAM_APP_ID = 'app-id'
    process.env.EDAMAM_API_KEY = 'app-key'
  })

  it('throws EdamamConfigError when credentials are missing', async () => {
    delete process.env.EDAMAM_APP_ID
    await expect(searchEdamamRecipes({ query: 'milanesa', number: 3 })).rejects.toBeInstanceOf(EdamamConfigError)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends the Edamam-Account-User header and app credentials', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { count: 1, hits: [hit()] }))

    await searchEdamamRecipes({ query: 'milanesa', number: 3 })

    const [url, options] = mockFetch.mock.calls[0]
    expect(url as string).toContain('app_id=app-id')
    expect(url as string).toContain('app_key=app-key')
    expect((options as RequestInit).headers).toEqual({ 'Edamam-Account-User': 'mi-despensa-app' })
  })

  it('combines query and includeIngredients into a single q param', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { count: 0, hits: [] }))
    await searchEdamamRecipes({ query: 'milanesa', includeIngredients: 'carne, pan rallado', number: 3 })
    const url = new URL(mockFetch.mock.calls[0][0] as string)
    expect(url.searchParams.get('q')).toBe('milanesa carne, pan rallado')
  })

  it('falls back to a generic query when neither query nor includeIngredients is given', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { count: 0, hits: [] }))
    await searchEdamamRecipes({ number: 3 })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('q=meal')
  })

  it('slices results down to the requested number', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(200, { count: 3, hits: [hit({ uri: 'r1' }), hit({ uri: 'r2' }), hit({ uri: 'r3' })] }),
    )
    const results = await searchEdamamRecipes({ query: 'milanesa', number: 2 })
    expect(results).toHaveLength(2)
  })

  it('throws EdamamQuotaError on 429', async () => {
    mockFetch.mockResolvedValue(jsonResponse(429, {}))
    await expect(searchEdamamRecipes({ query: 'milanesa', number: 3 })).rejects.toBeInstanceOf(EdamamQuotaError)
  })

  it('throws EdamamAuthError on 401', async () => {
    mockFetch.mockResolvedValue(jsonResponse(401, {}))
    await expect(searchEdamamRecipes({ query: 'milanesa', number: 3 })).rejects.toBeInstanceOf(EdamamAuthError)
  })
})

describe('getEdamamRecipeInformation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    process.env.EDAMAM_APP_ID = 'app-id'
    process.env.EDAMAM_API_KEY = 'app-key'
  })

  it('looks up a recipe by uri via the by-uri endpoint using the `r` param', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { count: 1, hits: [hit({ uri: 'recipe_42' })] }))

    const recipe = await getEdamamRecipeInformation('recipe_42')

    expect(recipe.uri).toBe('recipe_42')
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/by-uri?')
    expect(url).toContain(`r=${encodeURIComponent('recipe_42')}`)
  })

  it('throws when no matching recipe is found', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { count: 0, hits: [] }))
    await expect(getEdamamRecipeInformation('missing')).rejects.toThrow('Edamam recipe not found')
  })
})
