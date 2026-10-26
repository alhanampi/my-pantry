import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  chatConversation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  chatMessage: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
  mealPlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  mealPlanEntry: { deleteMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
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
const mockSuggestPossibleIngredients = vi.hoisted(() => vi.fn())
const mockTranslateIngredientNames = vi.hoisted(() => vi.fn())
vi.mock('../services/chatAssistant.js', () => ({
  streamChatReply: mockStreamChatReply,
  extractSearchCriteria: mockExtractSearchCriteria,
  suggestPossibleIngredients: mockSuggestPossibleIngredients,
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

const mockGenerateMealPlan = vi.hoisted(() => vi.fn())
const mockRefineMealPlan = vi.hoisted(() => vi.fn())
const mockSwapMeal = vi.hoisted(() => vi.fn())
const mockResolveMealImage = vi.hoisted(() => vi.fn())
vi.mock('../services/mealPlanAi.js', () => ({
  generateMealPlan: mockGenerateMealPlan,
  refineMealPlan: mockRefineMealPlan,
  swapMeal: mockSwapMeal,
  resolveMealImage: mockResolveMealImage,
  MealPlanGenerationError: class MealPlanGenerationError extends Error {},
}))

function generatedMeal(title: string) {
  return {
    title,
    description: `${title} description`,
    ingredients: [{ name: 'rice', amount: 200, unit: 'g' }],
    steps: [`Cook ${title}`],
    notes: '',
    prepTimeMinutes: 10,
    totalTimeMinutes: 20,
  }
}

describe('chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    mockSearchEdamamRecipes.mockResolvedValue([])
    mockResolveMealImage.mockResolvedValue('')
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
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

    it('emits an error frame (not an empty "done") when streamChatReply resolves with no real text', async () => {
      mockStreamChatReply.mockResolvedValue('   ')

      const res = await request(app)
        .post('/api/chat/conversations/c1/messages')
        .set('Authorization', 'Bearer good-token')
        .send({ content: 'hola' })

      expect(res.status).toBe(200)
      expect(res.text).toContain('"type":"error"')
      expect(res.text).not.toContain('"type":"done"')
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
        4,
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
      expect(mockSearchEdamamRecipes).toHaveBeenCalledWith(expect.objectContaining({ number: 3 }))
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

  describe('POST /conversations/:id/suggest-ingredients', () => {
    beforeEach(() => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'user_1',
        messages: [
          { role: 'user', content: 'quiero hacer comida china, tengo cebolla y fideos de arroz' },
          { role: 'assistant', content: 'qué otros ingredientes tenés a mano?' },
        ],
      })
    })

    it('returns the ingredients Groq suggests', async () => {
      mockSuggestPossibleIngredients.mockResolvedValue(['jengibre', 'ajo', 'salsa de soja'])

      const res = await request(app)
        .post('/api/chat/conversations/c1/suggest-ingredients')
        .set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.ingredients).toEqual(['jengibre', 'ajo', 'salsa de soja'])
      expect(mockSuggestPossibleIngredients).toHaveBeenCalledWith(
        [
          { role: 'user', content: 'quiero hacer comida china, tengo cebolla y fideos de arroz' },
          { role: 'assistant', content: 'qué otros ingredientes tenés a mano?' },
        ],
        'en',
      )
    })

    it('passes lang=es through from the query string', async () => {
      mockSuggestPossibleIngredients.mockResolvedValue([])

      await request(app)
        .post('/api/chat/conversations/c1/suggest-ingredients?lang=es')
        .set('Authorization', 'Bearer good-token')

      expect(mockSuggestPossibleIngredients).toHaveBeenCalledWith(expect.any(Array), 'es')
    })

    it('returns 404 for a conversation owned by someone else', async () => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/chat/conversations/c1/suggest-ingredients')
        .set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(404)
      expect(mockSuggestPossibleIngredients).not.toHaveBeenCalled()
    })

    it('surfaces a configError when Groq is not configured', async () => {
      const { ChatConfigError } = await import('../services/chatAssistant.js')
      mockSuggestPossibleIngredients.mockRejectedValue(new ChatConfigError())

      const res = await request(app)
        .post('/api/chat/conversations/c1/suggest-ingredients')
        .set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('configError')
    })

    it('surfaces quotaExceeded when Groq quota is hit', async () => {
      const { ChatQuotaError } = await import('../services/chatAssistant.js')
      mockSuggestPossibleIngredients.mockRejectedValue(new ChatQuotaError())

      const res = await request(app)
        .post('/api/chat/conversations/c1/suggest-ingredients')
        .set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('quotaExceeded')
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

    it('generates a plan via the AI service and persists one MealPlanEntry per meal', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(0)
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      mockGenerateMealPlan.mockResolvedValue({
        days: [{ dayOfWeek: 0, lunch: generatedMeal('Lunch A'), dinner: generatedMeal('Dinner A') }],
        batchPrepPlan: { menu: [], totalQuantities: [], cookingOrder: [], storageNotes: '', estimatedTotalMinutes: 30 },
      })
      mockPrisma.mealPlan.create.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        weekStart: new Date().toISOString(),
        days: [
          { id: 'e1', dayOfWeek: 0, mealType: 'lunch', title: 'Lunch A' },
          { id: 'e2', dayOfWeek: 0, mealType: 'dinner', title: 'Dinner A' },
        ],
      })

      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2, daysCount: 1 })

      expect(res.status).toBe(201)
      expect(mockGenerateMealPlan).toHaveBeenCalledWith(
        expect.objectContaining({ servings: 2, daysCount: 1, unitSystem: 'metric' }),
      )
      const createdDays = mockPrisma.mealPlan.create.mock.calls[0][0].data.days.create
      expect(createdDays).toHaveLength(2)
      expect(createdDays[0]).toMatchObject({ dayOfWeek: 0, mealType: 'lunch', title: 'Lunch A' })
      expect(createdDays[1]).toMatchObject({ dayOfWeek: 0, mealType: 'dinner', title: 'Dinner A' })
      expect(res.body.mealPlan.id).toBe('plan1')
    })

    it('includes a breakfast row per day only when includeBreakfast is true', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(0)
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      mockGenerateMealPlan.mockResolvedValue({
        days: [
          {
            dayOfWeek: 0,
            breakfast: generatedMeal('Breakfast A'),
            lunch: generatedMeal('Lunch A'),
            dinner: generatedMeal('Dinner A'),
          },
        ],
        batchPrepPlan: { menu: [], totalQuantities: [], cookingOrder: [], storageNotes: '', estimatedTotalMinutes: 30 },
      })
      mockPrisma.mealPlan.create.mockResolvedValue({ id: 'plan1', days: [] })

      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2, daysCount: 1, includeBreakfast: true })

      expect(res.status).toBe(201)
      expect(mockGenerateMealPlan).toHaveBeenCalledWith(expect.objectContaining({ includeBreakfast: true }))
      const createdDays = mockPrisma.mealPlan.create.mock.calls[0][0].data.days.create
      expect(createdDays.map((d: { mealType: string }) => d.mealType)).toEqual(['breakfast', 'lunch', 'dinner'])
    })

    it('returns 503 when the AI service reports a quota error', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(0)
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      const { ChatQuotaError } = await import('../services/chatAssistant.js')
      mockGenerateMealPlan.mockRejectedValue(new ChatQuotaError())

      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2 })

      expect(res.status).toBe(503)
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled()
    })

    it('returns a 500 with error "emptyPlan" instead of persisting a thin/empty plan', async () => {
      mockPrisma.mealPlan.count.mockResolvedValue(0)
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      const { MealPlanGenerationError } = await import('../services/mealPlanAi.js')
      mockGenerateMealPlan.mockRejectedValue(new MealPlanGenerationError())

      const res = await request(app)
        .post('/api/chat/meal-plan')
        .set('Authorization', 'Bearer good-token')
        .send({ dietaryRestrictions: [], servings: 2 })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('emptyPlan')
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled()
    })
  })

  describe('POST /meal-plan/:id/refine', () => {
    it('returns 404 when the plan is not owned by the caller', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(null)
      const res = await request(app)
        .post('/api/chat/meal-plan/plan1/refine')
        .set('Authorization', 'Bearer good-token')
        .send({ message: 'less spicy please' })
      expect(res.status).toBe(404)
    })

    it('rebuilds the current plan, calls refineMealPlan, and replaces the entries', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        dietaryRestrictions: ['vegetarian'],
        servings: 2,
        includeBreakfast: false,
        batchPrepPlan: { menu: [], totalQuantities: [], cookingOrder: [], storageNotes: '', estimatedTotalMinutes: 30 },
        days: [
          {
            dayOfWeek: 0,
            mealType: 'lunch',
            title: 'Old lunch',
            description: '',
            ingredients: [],
            steps: [],
            notes: '',
            prepTimeMinutes: 10,
            totalTimeMinutes: 20,
          },
          {
            dayOfWeek: 0,
            mealType: 'dinner',
            title: 'Old dinner',
            description: '',
            ingredients: [],
            steps: [],
            notes: '',
            prepTimeMinutes: 10,
            totalTimeMinutes: 20,
          },
        ],
      })
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      mockRefineMealPlan.mockResolvedValue({
        days: [{ dayOfWeek: 0, lunch: generatedMeal('New lunch'), dinner: generatedMeal('New dinner') }],
        batchPrepPlan: { menu: [], totalQuantities: [], cookingOrder: [], storageNotes: '', estimatedTotalMinutes: 30 },
      })
      mockPrisma.mealPlan.update.mockResolvedValue({
        id: 'plan1',
        days: [
          { id: 'e1', dayOfWeek: 0, mealType: 'lunch', title: 'New lunch' },
          { id: 'e2', dayOfWeek: 0, mealType: 'dinner', title: 'New dinner' },
        ],
      })

      const res = await request(app)
        .post('/api/chat/meal-plan/plan1/refine')
        .set('Authorization', 'Bearer good-token')
        .send({ message: 'less spicy please' })

      expect(res.status).toBe(200)
      expect(mockRefineMealPlan).toHaveBeenCalledWith(
        expect.objectContaining({ days: expect.any(Array) }),
        'less spicy please',
        expect.objectContaining({ dietaryRestrictions: ['vegetarian'], servings: 2 }),
      )
      expect(mockPrisma.mealPlanEntry.deleteMany).toHaveBeenCalledWith({ where: { mealPlanId: 'plan1' } })
      const createdDays = mockPrisma.mealPlan.update.mock.calls[0][0].data.days.create
      expect(createdDays).toHaveLength(2)
      expect(res.body.mealPlan.id).toBe('plan1')
    })
  })

  describe('POST /meal-plan/:id/swap-meal', () => {
    const existingPlan = {
      id: 'plan1',
      ownerId: 'user_1',
      dietaryRestrictions: ['vegetarian'],
      servings: 2,
      includeBreakfast: false,
      days: [
        { id: 'e1', dayOfWeek: 0, mealType: 'lunch', title: 'Old lunch' },
        { id: 'e2', dayOfWeek: 0, mealType: 'dinner', title: 'Old dinner' },
      ],
    }

    it('returns 404 when the plan is not owned by the caller', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(null)
      const res = await request(app)
        .post('/api/chat/meal-plan/plan1/swap-meal')
        .set('Authorization', 'Bearer good-token')
        .send({ dayOfWeek: 0, mealType: 'lunch' })
      expect(res.status).toBe(404)
    })

    it('returns 404 when the requested slot has no entry in this plan', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(existingPlan)
      const res = await request(app)
        .post('/api/chat/meal-plan/plan1/swap-meal')
        .set('Authorization', 'Bearer good-token')
        .send({ dayOfWeek: 3, mealType: 'lunch' })
      expect(res.status).toBe(404)
      expect(mockSwapMeal).not.toHaveBeenCalled()
    })

    it('excludes the current dish and the rest of the week, and updates only that entry', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(existingPlan)
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      mockSwapMeal.mockResolvedValue(generatedMeal('New lunch'))
      mockResolveMealImage.mockResolvedValue('new-lunch.jpg')
      mockPrisma.mealPlanEntry.update.mockResolvedValue({ id: 'e1', title: 'New lunch' })

      const res = await request(app)
        .post('/api/chat/meal-plan/plan1/swap-meal')
        .set('Authorization', 'Bearer good-token')
        .send({ dayOfWeek: 0, mealType: 'lunch', reason: 'no me gusta el pescado' })

      expect(res.status).toBe(200)
      expect(mockSwapMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          dayOfWeek: 0,
          mealType: 'lunch',
          excludeTitle: 'Old lunch',
          otherTitlesInPlan: ['Old dinner'],
          reason: 'no me gusta el pescado',
          dietaryRestrictions: ['vegetarian'],
          servings: 2,
        }),
      )
      expect(mockPrisma.mealPlanEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e1' },
          data: expect.objectContaining({ title: 'New lunch', image: 'new-lunch.jpg' }),
        }),
      )
      expect(res.body.entry.title).toBe('New lunch')
    })

    it('returns 503 when the AI service reports a quota error', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(existingPlan)
      mockPrisma.user.findUnique.mockResolvedValue({ unitSystem: 'metric' })
      const { ChatQuotaError } = await import('../services/chatAssistant.js')
      mockSwapMeal.mockRejectedValue(new ChatQuotaError())

      const res = await request(app)
        .post('/api/chat/meal-plan/plan1/swap-meal')
        .set('Authorization', 'Bearer good-token')
        .send({ dayOfWeek: 0, mealType: 'lunch' })

      expect(res.status).toBe(503)
      expect(mockPrisma.mealPlanEntry.update).not.toHaveBeenCalled()
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
          { id: 'e1', dayOfWeek: 0, mealType: 'lunch', ingredients: [{ name: 'rice', amount: 200, unit: 'g' }] },
          { id: 'e2', dayOfWeek: 1, mealType: 'lunch', ingredients: [{ name: 'rice', amount: 200, unit: 'g' }] },
        ],
      })
    })

    it('returns 404 when the plan is not owned by the caller', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue(null)
      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(404)
    })

    it('unions ingredients across every meal in the plan and subtracts a parseable pantry quantity', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'rice', quantity: '150 g' }])

      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      // 200 + 200 (two days) - 150 (pantry) = 250
      expect(res.body.items).toEqual([{ name: 'rice', quantity: '250 g', pantryNote: false }])
    })

    it('drops a line entirely once parseable pantry quantities fully cover it', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        days: [{ id: 'e1', dayOfWeek: 0, mealType: 'lunch', ingredients: [{ name: 'salt', amount: 5, unit: 'g' }] }],
      })
      mockPrisma.product.findMany.mockResolvedValue([{ name: 'salt', quantity: '1000 g' }])

      const res = await request(app).post('/api/chat/meal-plan/plan1/consolidate').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
    })

    it('keeps the full line with a pantryNote when the matching pantry quantity cannot be parsed', async () => {
      mockPrisma.mealPlan.findFirst.mockResolvedValue({
        id: 'plan1',
        ownerId: 'user_1',
        days: [
          { id: 'e1', dayOfWeek: 0, mealType: 'lunch', ingredients: [{ name: 'flour', amount: 300, unit: 'g' }] },
          { id: 'e2', dayOfWeek: 1, mealType: 'lunch', ingredients: [{ name: 'flour', amount: 300, unit: 'g' }] },
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
