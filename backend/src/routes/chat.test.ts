import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  chatConversation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  chatMessage: { create: vi.fn() },
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
vi.mock('../services/chatAssistant.js', () => ({
  streamChatReply: mockStreamChatReply,
  extractSearchCriteria: mockExtractSearchCriteria,
  mapDietaryRestrictionsToSpoonacularDiet: vi.fn(() => undefined),
  ChatConfigError: class ChatConfigError extends Error {},
  ChatQuotaError: class ChatQuotaError extends Error {},
}))

const mockSearchRecipesWithFallback = vi.hoisted(() => vi.fn())
vi.mock('../services/spoonacular.js', () => ({
  searchRecipesWithFallback: mockSearchRecipesWithFallback,
  getRecipeInformation: vi.fn(),
  SpoonacularQuotaError: class extends Error {},
  SpoonacularAuthError: class extends Error {},
  SpoonacularConfigError: class extends Error {},
}))

describe('chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
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
})
