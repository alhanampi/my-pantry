import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import { SpoonacularQuotaError, SpoonacularConfigError } from '../services/spoonacular.js'

vi.mock('../db/index.js', () => ({
  default: {
    userLink: { findFirst: vi.fn() },
    shoppingList: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

const mockSearchRecipes = vi.hoisted(() => vi.fn())
const mockGetRecipeInformation = vi.hoisted(() => vi.fn())
vi.mock('../services/spoonacular.js', async () => {
  const actual = await vi.importActual<typeof import('../services/spoonacular.js')>('../services/spoonacular.js')
  return {
    ...actual,
    searchRecipes: mockSearchRecipes,
    getRecipeInformation: mockGetRecipeInformation,
  }
})

const mockTranslate = vi.hoisted(() => vi.fn())
vi.mock('../services/groq.js', () => ({ translateRecipeContent: mockTranslate }))

const mockSearchEdamamRecipes = vi.hoisted(() => vi.fn())
const mockGetEdamamRecipeInformation = vi.hoisted(() => vi.fn())
vi.mock('../services/edamam.js', async () => {
  const actual = await vi.importActual<typeof import('../services/edamam.js')>('../services/edamam.js')
  return {
    ...actual,
    searchEdamamRecipes: mockSearchEdamamRecipes,
    getEdamamRecipeInformation: mockGetEdamamRecipeInformation,
  }
})

const sampleRecipe = {
  id: 1,
  title: 'Pasta',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 20,
  extendedIngredients: [{ id: 10, name: 'Pasta', amount: 200, unit: 'g', original: '200g pasta' }],
  analyzedInstructions: [{ steps: [{ number: 1, step: 'Boil water.' }] }],
  nutrition: { nutrients: [{ name: 'Calories', amount: 350, unit: 'kcal' }] },
}

describe('recipes routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchEdamamRecipes.mockResolvedValue([])
  })

  it('GET /api/recipes/search returns normalized cards, capped at 4 server-side', async () => {
    mockSearchRecipes.mockResolvedValue({ results: [sampleRecipe], offset: 0, number: 4, totalResults: 1 })

    const res = await request(app).get('/api/recipes/search').query({ query: 'pasta' })

    expect(res.status).toBe(200)
    expect(mockSearchRecipes).toHaveBeenCalledWith(expect.objectContaining({ number: 4 }))
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].title).toBe('Pasta')
    expect(mockTranslate).not.toHaveBeenCalled()
  })

  it('GET /api/recipes/search translates when lang=es', async () => {
    mockSearchRecipes.mockResolvedValue({ results: [sampleRecipe], offset: 0, number: 4, totalResults: 1 })
    mockTranslate.mockResolvedValue({ title: 'Pasta (es)', ingredientNames: ['Pasta'], instructionSteps: [] })

    const res = await request(app).get('/api/recipes/search').query({ lang: 'es' })

    expect(res.status).toBe(200)
    expect(mockTranslate).toHaveBeenCalled()
    expect(res.body.results[0].title).toBe('Pasta (es)')
  })

  it('GET /api/recipes/search returns 400 for an invalid lang', async () => {
    const res = await request(app).get('/api/recipes/search').query({ lang: 'fr' })
    expect(res.status).toBe(400)
    expect(mockSearchRecipes).not.toHaveBeenCalled()
  })

  it('GET /api/recipes/search returns 503 quotaExceeded when Spoonacular quota is hit', async () => {
    mockSearchRecipes.mockRejectedValue(new SpoonacularQuotaError())

    const res = await request(app).get('/api/recipes/search')

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('quotaExceeded')
  })

  it('GET /api/recipes/search returns 500 configError when SPOONACULAR_KEY is missing', async () => {
    mockSearchRecipes.mockRejectedValue(new SpoonacularConfigError())

    const res = await request(app).get('/api/recipes/search')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('configError')
  })

  it('GET /api/recipes/:id returns a full detail with nutrition and instructions', async () => {
    mockGetRecipeInformation.mockResolvedValue(sampleRecipe)

    const res = await request(app).get('/api/recipes/spoonacular:1')

    expect(res.status).toBe(200)
    expect(mockGetRecipeInformation).toHaveBeenCalledWith(1)
    expect(res.body.recipe.servings).toBe(2)
    expect(res.body.recipe.instructions).toEqual(['Boil water.'])
    expect(res.body.recipe.nutrition.calories).toBe(350)
  })

  it('GET /api/recipes/:id returns 400 for an id with no recognized "source:externalId" shape', async () => {
    const res = await request(app).get('/api/recipes/not-a-number')
    expect(res.status).toBe(400)
    expect(mockGetRecipeInformation).not.toHaveBeenCalled()
  })

  const edamamRecipe = {
    uri: 'http://www.edamam.com/ontologies/edamam.owl#recipe_abc',
    label: 'Salad',
    image: 'salad.jpg',
    source: 'Example',
    url: 'https://example.com/salad',
    yield: 2,
    totalTime: 10,
    ingredientLines: ['lettuce'],
    ingredients: [{ text: 'lettuce', quantity: 1, measure: null, food: 'lettuce', weight: 50 }],
    totalNutrients: {},
    totalDaily: {},
  }

  it('GET /api/recipes/search supplements with Edamam when Spoonacular returns fewer than requested', async () => {
    mockSearchRecipes.mockResolvedValue({ results: [sampleRecipe], offset: 0, number: 4, totalResults: 1 })
    mockSearchEdamamRecipes.mockResolvedValue([edamamRecipe, edamamRecipe, edamamRecipe])

    const res = await request(app).get('/api/recipes/search').query({ query: 'pasta' })

    expect(res.status).toBe(200)
    expect(mockSearchEdamamRecipes).toHaveBeenCalledWith(expect.objectContaining({ number: 3 }))
    expect(res.body.results).toHaveLength(4)
    expect(res.body.results[1].source).toBe('edamam')
  })

  it('GET /api/recipes/search still returns 200 with Spoonacular-only results when Edamam fails', async () => {
    mockSearchRecipes.mockResolvedValue({ results: [sampleRecipe], offset: 0, number: 4, totalResults: 1 })
    mockSearchEdamamRecipes.mockRejectedValue(new Error('boom'))

    const res = await request(app).get('/api/recipes/search').query({ query: 'pasta' })

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
  })

  it('GET /api/recipes/search never calls Edamam for a page past the first', async () => {
    mockSearchRecipes.mockResolvedValue({ results: [sampleRecipe], offset: 4, number: 4, totalResults: 5 })

    const res = await request(app).get('/api/recipes/search').query({ query: 'pasta', offset: 4 })

    expect(res.status).toBe(200)
    expect(mockSearchEdamamRecipes).not.toHaveBeenCalled()
  })
})
