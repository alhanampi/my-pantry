import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  chatConversation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  chatMessage: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
  mealPlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))
vi.mock('../services/groq.js', () => ({ translateRecipeContent: vi.fn() }))

const mockStreamChatReply = vi.hoisted(() => vi.fn())
const mockExtractSearchCriteria = vi.hoisted(() => vi.fn())
const mockTranslateIngredientNames = vi.hoisted(() => vi.fn())
vi.mock('../services/chatAssistant.js', () => ({
  streamChatReply: mockStreamChatReply,
  extractSearchCriteria: mockExtractSearchCriteria,
  translateIngredientNames: mockTranslateIngredientNames,
  mapDietaryRestrictionsToSpoonacularDiet: vi.fn(() => undefined),
  // Real logic (not a stub) — several assertions below care about which
  // unitSystem actually reaches streamChatReply.
  resolveUnitSystem: vi.fn((explicit: string | null | undefined, language: string) =>
    explicit === 'metric' || explicit === 'imperial' ? explicit : language.startsWith('es') ? 'metric' : 'imperial',
  ),
  ChatConfigError: class ChatConfigError extends Error {},
  ChatQuotaError: class ChatQuotaError extends Error {},
}))

const mockSearchRecipesWithFallback = vi.hoisted(() => vi.fn())
const mockGetRecipeInformation = vi.hoisted(() => vi.fn())
vi.mock('../services/spoonacular.js', () => ({
  searchRecipesWithFallback: mockSearchRecipesWithFallback,
  getRecipeInformation: mockGetRecipeInformation,
  SpoonacularQuotaError: class extends Error {},
  SpoonacularAuthError: class extends Error {},
  SpoonacularConfigError: class extends Error {},
}))

const mockSearchEdamamRecipes = vi.hoisted(() => vi.fn())
const mockGetEdamamRecipeInformation = vi.hoisted(() => vi.fn())
vi.mock('../services/edamam.js', () => ({
  searchEdamamRecipes: mockSearchEdamamRecipes,
  getEdamamRecipeInformation: mockGetEdamamRecipeInformation,
  EdamamQuotaError: class extends Error {},
  EdamamAuthError: class extends Error {},
  EdamamConfigError: class extends Error {},
}))

describe('chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    mockSearchEdamamRecipes.mockResolvedValue([])
  })

  it('GET /conversations returns 401 without a token', async () => {
    const res = await request(app).get('/api/chat/conversations')
    expect(res.status).toBe(401)
  })

  it('GET /conversations returns the caller\'s conversations', async () => {
    mockPrisma.chatConversation.findMany.mockResolvedValue([{ id: 'c1', title: 'New chat' }])
    const res = await request(app).get('/api/chat/conversations').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(res.body.conversations).toHaveLength(1)
    expect(mockPrisma.chatConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } }),
    )
  })

  it('POST /conversations creates a conversation with dietaryRestrictions + servings', async () => {
    mockPrisma.chatConversation.count.mockResolvedValue(0)
    mockPrisma.chatConversation.create.mockResolvedValue({ id: 'c1', title: 'New chat', dietaryRestrictions: ['vegan'], servings: 2 })

    const res = await request(app)
      .post('/api/chat/conversations')
      .set('Authorization', 'Bearer good-token')
      .send({ dietaryRestrictions: ['vegan'], servings: 2 })

    expect(res.status).toBe(201)
    expect(mockPrisma.chatConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: 'user_1', dietaryRestrictions: ['vegan'], servings: 2 }) }),
    )
  })

  it('POST /conversations returns 400 for invalid servings', async () => {
    const res = await request(app)
      .post('/api/chat/conversations')
      .set('Authorization', 'Bearer good-token')
      .send({ dietaryRestrictions: [], servings: 0 })

    expect(res.status).toBe(400)
    expect(mockPrisma.chatConversation.create).not.toHaveBeenCalled()
  })

  it('POST /conversations returns 400 over MAX_CONVERSATIONS_PER_USER', async () => {
    mockPrisma.chatConversation.count.mockResolvedValue(20)
    const res = await request(app)
      .post('/api/chat/conversations')
      .set('Authorization', 'Bearer good-token')
      .send({ dietaryRestrictions: [], servings: 2 })

    expect(res.status).toBe(400)
    expect(mockPrisma.chatConversation.create).not.toHaveBeenCalled()
  })

  it('GET /conversations/:id returns 404 when not owned', async () => {
    mockPrisma.chatConversation.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/chat/conversations/c1').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(404)
  })

  it('DELETE /conversations/:id deletes an owned conversation', async () => {
    mockPrisma.chatConversation.findFirst.mockResolvedValue({ id: 'c1', ownerId: 'user_1' })
    const res = await request(app).delete('/api/chat/conversations/c1').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(mockPrisma.chatConversation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  describe('POST /conversations/:id/messages', () => {
    beforeEach(() => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'user_1',
        dietaryRestrictions: [],
        servings: 2,
        messages: [],
      })
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'm1' })
      mockPrisma.chatConversation.update.mockResolvedValue({})
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: null })
      mockPrisma.product.findMany.mockResolvedValue([])
    })

    it('resolves unitSystem from the account (not the request body) and passes it to streamChatReply', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'imperial' })
      mockStreamChatReply.mockResolvedValue('ok')

      await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola', language: 'es' })

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        select: { unitSystem: true },
      })
      expect(mockStreamChatReply).toHaveBeenCalledWith(
        expect.objectContaining({ unitSystem: 'imperial' }),
      )
    })

    it('falls back to the language-based default when the account never set unitSystem', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: null })
      mockStreamChatReply.mockResolvedValue('ok')

      await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola', language: 'es' })

      expect(mockStreamChatReply).toHaveBeenCalledWith(
        expect.objectContaining({ unitSystem: 'metric' }),
      )
    })

    it('streams tokens and persists the user + assistant messages', async () => {
      mockStreamChatReply.mockImplementation(async ({ onToken }: { onToken: (t: string) => void }) => {
        onToken('Hola')
        onToken(' mundo')
        return 'Hola mundo'
      })

      const res = await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'Tengo arroz y pollo', language: 'es' })

      expect(res.status).toBe(200)
      expect(res.text).toContain('"type":"token"')
      expect(res.text).toContain('"type":"done"')
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'user', content: 'Tengo arroz y pollo' }) }),
      )
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'assistant', content: 'Hola mundo' }) }),
      )
    })

    it('returns 404 when the conversation is not owned by the caller', async () => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue(null)
      const res = await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola' })
      expect(res.status).toBe(404)
    })

    it('returns 400 for empty content', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: '' })
      expect(res.status).toBe(400)
    })

    it('returns 400 once the conversation hits the message-count guardrail', async () => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'user_1',
        dietaryRestrictions: [],
        servings: 2,
        messages: new Array(60).fill({ role: 'user', content: 'x' }),
      })
      const res = await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'one more' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('conversationTooLong')
    })

    it('emits an error frame instead of persisting a partial reply on a Groq failure', async () => {
      const { ChatConfigError } = await import('../services/chatAssistant.js')
      mockStreamChatReply.mockRejectedValue(new ChatConfigError())

      const res = await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola' })

      expect(res.status).toBe(200)
      expect(res.text).toContain('"type":"error"')
      expect(res.text).toContain('configError')
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(1) // only the user message
    })

    it('passes a pantrySummary built from the account\'s own products, scoped to the caller', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'Arroz' }, { name: 'Pollo' }])
      mockStreamChatReply.mockResolvedValue('ok')

      await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola' })

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user_1' } }),
      )
      expect(mockStreamChatReply).toHaveBeenCalledWith(
        expect.objectContaining({ pantrySummary: 'Arroz, Pollo' }),
      )
    })

    it('omits pantrySummary entirely when the pantry is empty', async () => {
      mockPrisma.product.findMany.mockResolvedValue([])
      mockStreamChatReply.mockResolvedValue('ok')

      await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola' })

      expect(mockStreamChatReply).toHaveBeenCalledWith(
        expect.objectContaining({ pantrySummary: undefined }),
      )
    })
  })

  describe('POST /pantry-suggestions', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).post('/api/chat/pantry-suggestions')
      expect(res.status).toBe(401)
    })

    it('returns an empty list without calling Spoonacular when the pantry is empty', async () => {
      mockPrisma.product.findMany.mockResolvedValue([])

      const res = await request(app).post('/api/chat/pantry-suggestions').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.recipes).toEqual([])
      expect(mockSearchRecipesWithFallback).not.toHaveBeenCalled()
    })

    it("translates the caller's own pantry item names to English before querying Spoonacular", async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'Arroz' }, { name: 'Pollo' }])
      mockTranslateIngredientNames.mockResolvedValue(['Rice', 'Chicken'])
      mockSearchRecipesWithFallback.mockResolvedValue({
        results: [{ id: 1, title: 'Chicken rice', image: 'img.jpg', servings: 2, readyInMinutes: 25, extendedIngredients: [], nutrition: { nutrients: [] } }],
        offset: 0,
        number: 3,
        totalResults: 1,
      })

      const res = await request(app).post('/api/chat/pantry-suggestions').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user_1' } }),
      )
      expect(mockTranslateIngredientNames).toHaveBeenCalledWith(['Arroz', 'Pollo'])
      expect(mockSearchRecipesWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({ includeIngredients: 'Rice,Chicken' }),
        3,
      )
      expect(res.body.recipes).toHaveLength(1)
    })

    it('surfaces a configError when the translation call fails (e.g. Groq not configured)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'Arroz' }])
      const { ChatConfigError } = await import('../services/chatAssistant.js')
      mockTranslateIngredientNames.mockRejectedValue(new ChatConfigError())

      const res = await request(app).post('/api/chat/pantry-suggestions').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('configError')
      expect(mockSearchRecipesWithFallback).not.toHaveBeenCalled()
    })

    it('supplements thin Spoonacular results with Edamam recipes up to the requested count', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'Arroz' }, { name: 'Pollo' }])
      mockTranslateIngredientNames.mockResolvedValue(['Rice', 'Chicken'])
      mockSearchRecipesWithFallback.mockResolvedValue({
        results: [{ id: 1, title: 'Chicken rice', image: 'img.jpg', servings: 2, readyInMinutes: 25, extendedIngredients: [], nutrition: { nutrients: [] } }],
        offset: 0,
        number: 3,
        totalResults: 1,
      })
      mockSearchEdamamRecipes.mockResolvedValue([
        {
          uri: 'http://www.edamam.com/ontologies/edamam.owl#recipe_abc',
          label: 'Rice bowl',
          image: 'img2.jpg',
          source: 'Example',
          url: 'https://example.com/rice-bowl',
          yield: 2,
          totalTime: 15,
          ingredientLines: ['rice'],
          ingredients: [{ text: 'rice', quantity: 1, measure: null, food: 'rice', weight: 100 }],
          totalNutrients: {},
          totalDaily: {},
        },
      ])

      const res = await request(app).post('/api/chat/pantry-suggestions').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(mockSearchEdamamRecipes).toHaveBeenCalledWith(expect.objectContaining({ number: 2 }))
      expect(res.body.recipes).toHaveLength(2)
      expect(res.body.recipes[1].source).toBe('edamam')
    })
  })

  describe('POST /conversations/:id/suggest-recipe', () => {
    beforeEach(() => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'user_1',
        dietaryRestrictions: [],
        servings: 2,
        messages: [{ role: 'user', content: 'tengo arroz y pollo, 30 minutos' }],
      })
    })

    it('returns recipe cards derived from extracted search criteria', async () => {
      mockExtractSearchCriteria.mockResolvedValue({ includeIngredients: 'rice,chicken' })
      mockSearchRecipesWithFallback.mockResolvedValue({
        results: [{ id: 1, title: 'Chicken rice', image: 'img.jpg', servings: 2, readyInMinutes: 25, extendedIngredients: [], nutrition: { nutrients: [] } }],
        offset: 0,
        number: 3,
        totalResults: 1,
      })

      const res = await request(app)
        .post('/api/chat/conversations/c1/suggest-recipe')
        .set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.recipes).toHaveLength(1)
      expect(mockSearchRecipesWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({ includeIngredients: 'rice,chicken' }),
        3,
      )
    })

    it('still calls Spoonacular (and returns recipes) even when Groq extracts nothing at all', async () => {
      mockExtractSearchCriteria.mockResolvedValue({})
      mockSearchRecipesWithFallback.mockResolvedValue({
        results: [{ id: 2, title: 'Surprise me', image: 'img.jpg', servings: 2, readyInMinutes: 20, extendedIngredients: [], nutrition: { nutrients: [] } }],
        offset: 0,
        number: 3,
        totalResults: 1,
      })

      const res = await request(app)
        .post('/api/chat/conversations/c1/suggest-recipe')
        .set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.recipes).toHaveLength(1)
      expect(mockSearchRecipesWithFallback).toHaveBeenCalledWith(expect.any(Object), 3)
    })
  })

  describe('POST /meal-plan', () => {
    it('returns 400 for invalid servings', async () => {
      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 0 })
      expect(res.status).toBe(400)
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled()
    })

    it('returns 400 once the per-user meal-plan cap is reached', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(10)
      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2 })
      expect(res.status).toBe(400)
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled()
    })

    it('generates one recipe per day and persists a MealPlan with MealPlanEntry rows', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(0)
      mockSearchRecipesWithFallback.mockResolvedValue({
        results: [{ id: 1, title: 'Recipe A', image: 'a.jpg', servings: 2, readyInMinutes: 20, extendedIngredients: [], nutrition: { nutrients: [] } }],
        offset: 0,
        number: 3,
        totalResults: 1,
      })
      mockPrisma.mealPlan.create.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        weekStart: new Date().toISOString(),
        days: [{ id: 'e1', dayOfWeek: 0, recipeId: 'spoonacular:1', title: 'Recipe A', image: 'a.jpg' }],
      })

      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2, daysCount: 1 })

      expect(res.status).toBe(201)
      expect(mockPrisma.mealPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'user_1',
            days: { create: [expect.objectContaining({ dayOfWeek: 0, recipeId: 'spoonacular:1', title: 'Recipe A' })] },
          }),
        }),
      )
      expect(res.body.mealPlan.id).toBe('plan1')
    })

    it('never repeats a recipe across days, even when a pick comes from Edamam', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(0)
      mockSearchRecipesWithFallback.mockResolvedValue({
        results: [{ id: 1, title: 'Recipe A', image: 'a.jpg', servings: 2, readyInMinutes: 20, extendedIngredients: [], nutrition: { nutrients: [] } }],
        offset: 0,
        number: 3,
        totalResults: 1,
      })
      mockSearchEdamamRecipes.mockResolvedValue([
        {
          uri: 'http://www.edamam.com/ontologies/edamam.owl#recipe_xyz',
          label: 'Recipe B',
          image: 'b.jpg',
          source: 'Example',
          url: 'https://example.com/recipe-b',
          yield: 2,
          totalTime: 20,
          ingredientLines: [],
          ingredients: [],
          totalNutrients: {},
          totalDaily: {},
        },
      ])
      mockPrisma.mealPlan.create.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        weekStart: new Date().toISOString(),
        days: [
          { id: 'e1', dayOfWeek: 0, recipeId: 'spoonacular:1', title: 'Recipe A', image: 'a.jpg' },
          { id: 'e2', dayOfWeek: 1, recipeId: 'edamam:http://www.edamam.com/ontologies/edamam.owl#recipe_xyz', title: 'Recipe B', image: 'b.jpg' },
        ],
      })

      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2, daysCount: 2 })

      expect(res.status).toBe(201)
      const createdDays = mockPrisma.mealPlan.create.mock.calls[0][0].data.days.create
      expect(createdDays).toHaveLength(2)
      expect(createdDays[0].recipeId).toBe('spoonacular:1')
      expect(createdDays[1].recipeId).toContain('edamam:')
      expect(createdDays[0].recipeId).not.toBe(createdDays[1].recipeId)
    })
  })

  describe('GET /meal-plan/current', () => {
    it('returns the caller\'s most recent meal plan', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue({ id: 'plan1', ownerId: 'user_1', weekStart: new Date().toISOString(), days: [] })

      const res = await request(app).get('/api/chat/meal-plan/current').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(mockPrisma.mealPlan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user_1' } }),
      )
      expect(res.body.mealPlan.id).toBe('plan1')
    })

    it('returns null when the caller has no meal plan yet', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(null)
      const res = await request(app).get('/api/chat/meal-plan/current').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(200)
      expect(res.body.mealPlan).toBeNull()
    })
  })

  describe('DELETE /meal-plan/:id', () => {
    it('returns 404 when the plan is not owned by the caller', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(null)
      const res = await request(app).delete('/api/chat/meal-plan/plan1').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(404)
      expect(mockPrisma.mealPlan.delete).not.toHaveBeenCalled()
    })

    it('deletes an owned plan', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue({ id: 'plan1', ownerId: 'user_1' })
      const res = await request(app).delete('/api/chat/meal-plan/plan1').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(200)
      expect(mockPrisma.mealPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan1' } })
    })
  })

  describe('POST /meal-plan/:id/consolidate', () => {
    beforeEach(() => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        days: [
          { id: 'e1', dayOfWeek: 0, recipeId: 'spoonacular:1' },
          { id: 'e2', dayOfWeek: 1, recipeId: 'spoonacular:2' },
        ],
      })
    })

    it('returns 404 when the plan is not owned by the caller', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(null)
      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(404)
    })

    it('unions ingredients across every recipe in the plan and subtracts a parseable pantry quantity', async () => {
      mockGetRecipeInformation.mockImplementation(async (id: number) => ({
        id,
        extendedIngredients: [
          { id: 10, name: 'rice', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' }, us: { amount: 7, unitShort: 'oz' } } },
        ],
      }))
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'rice', quantity: '150 g' }])

      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      // 200 + 200 (two days) - 150 (pantry) = 250
      expect(res.body.items).toEqual([{ name: 'rice', quantity: '250 g', pantryNote: false }])
    })

    it('drops a line entirely once parseable pantry quantities fully cover it', async () => {
      mockGetRecipeInformation.mockResolvedValue({
        id: 1,
        extendedIngredients: [
          { id: 10, name: 'salt', amount: 5, unit: 'g', measures: { metric: { amount: 5, unitShort: 'g' }, us: { amount: 1, unitShort: 'tsp' } } },
        ],
      })
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'salt', quantity: '1000 g' }])

      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
    })

    it('keeps the full line with a pantryNote when the matching pantry quantity cannot be parsed', async () => {
      mockGetRecipeInformation.mockResolvedValue({
        id: 1,
        extendedIngredients: [
          { id: 10, name: 'flour', amount: 300, unit: 'g', measures: { metric: { amount: 300, unitShort: 'g' }, us: { amount: 10, unitShort: 'oz' } } },
        ],
      })
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'flour', quantity: 'un paquete' }])

      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      // Union across both days in the fixture plan (300g x2) — kept at the
      // full unreduced amount since the pantry quantity was unparseable.
      expect(res.body.items).toEqual([{ name: 'flour', quantity: '600 g', pantryNote: true }])
    })
  })
})
