import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'
import { SpoonacularQuotaError } from '../services/spoonacular.js'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  shoppingList: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  favoriteRecipe: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

const mockGetRecipeInformation = vi.hoisted(() => vi.fn())
vi.mock('../services/spoonacular.js', async () => {
  const actual = await vi.importActual<typeof import('../services/spoonacular.js')>('../services/spoonacular.js')
  return { ...actual, searchRecipes: vi.fn(), getRecipeInformation: mockGetRecipeInformation }
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
  nutrition: { nutrients: [{ name: 'Calories', amount: 350, unit: 'kcal' }] },
}

describe('recipe favorites routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  })

  it('GET /ids returns 401 without a token', async () => {
    const res = await request(app).get('/api/recipes/favorites/ids')
    expect(res.status).toBe(401)
  })

  it('GET /ids returns the caller-scoped favorite recipe ids', async () => {
    mockPrisma.favoriteRecipe.findMany.mockResolvedValue([{ recipeId: 1 }, { recipeId: 2 }])

    const res = await request(app).get('/api/recipes/favorites/ids').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.ids).toEqual([1, 2])
    expect(mockPrisma.favoriteRecipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } }),
    )
  })

  it('GET / hydrates favorites into recipe cards', async () => {
    mockPrisma.favoriteRecipe.findMany.mockResolvedValue([{ recipeId: 1 }])
    mockGetRecipeInformation.mockResolvedValue(sampleRecipe)

    const res = await request(app).get('/api/recipes/favorites').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].title).toBe('Pasta')
    expect(mockTranslate).not.toHaveBeenCalled()
  })

  it('GET / skips a favorite whose recipe 404s upstream instead of failing the whole list', async () => {
    mockPrisma.favoriteRecipe.findMany.mockResolvedValue([{ recipeId: 1 }, { recipeId: 2 }])
    mockGetRecipeInformation.mockResolvedValueOnce(sampleRecipe).mockRejectedValueOnce(new Error('not found'))

    const res = await request(app).get('/api/recipes/favorites').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
  })

  it('GET / returns 503 quotaExceeded when Spoonacular quota is hit outright', async () => {
    mockPrisma.favoriteRecipe.findMany.mockRejectedValue(new SpoonacularQuotaError())

    const res = await request(app).get('/api/recipes/favorites').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('quotaExceeded')
  })

  it('POST / upserts a favorite', async () => {
    mockPrisma.favoriteRecipe.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/recipes/favorites')
      .set('Authorization', 'Bearer good-token')
      .send({ recipeId: 42 })

    expect(res.status).toBe(201)
    expect(mockPrisma.favoriteRecipe.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId_recipeId: { ownerId: 'user_1', recipeId: 42 } },
        create: { ownerId: 'user_1', recipeId: 42 },
      }),
    )
  })

  it('POST / returns 400 for a non-numeric recipeId', async () => {
    const res = await request(app)
      .post('/api/recipes/favorites')
      .set('Authorization', 'Bearer good-token')
      .send({ recipeId: 'nope' })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteRecipe.upsert).not.toHaveBeenCalled()
  })

  it('POST / returns 400 once MAX_FAVORITES_PER_USER is reached', async () => {
    mockPrisma.favoriteRecipe.count.mockResolvedValue(100)

    const res = await request(app)
      .post('/api/recipes/favorites')
      .set('Authorization', 'Bearer good-token')
      .send({ recipeId: 42 })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteRecipe.upsert).not.toHaveBeenCalled()
  })

  it('DELETE /:recipeId removes a favorite, scoped to the caller', async () => {
    const res = await request(app).delete('/api/recipes/favorites/42').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.favoriteRecipe.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user_1', recipeId: 42 },
    })
  })

  it('DELETE /:recipeId returns 400 for a non-numeric id', async () => {
    const res = await request(app).delete('/api/recipes/favorites/nope').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteRecipe.deleteMany).not.toHaveBeenCalled()
  })
})
