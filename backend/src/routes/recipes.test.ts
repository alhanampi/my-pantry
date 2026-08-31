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

    const res = await request(app).get('/api/recipes/1')

    expect(res.status).toBe(200)
    expect(res.body.recipe.servings).toBe(2)
    expect(res.body.recipe.instructions).toEqual(['Boil water.'])
    expect(res.body.recipe.nutrition.calories).toBe(350)
  })

  it('GET /api/recipes/:id returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/recipes/not-a-number')
    expect(res.status).toBe(400)
    expect(mockGetRecipeInformation).not.toHaveBeenCalled()
  })
})
