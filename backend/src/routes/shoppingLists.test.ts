import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  shoppingList: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))
vi.mock('../services/spoonacular.js', () => ({
  searchRecipes: vi.fn(),
  getRecipeInformation: vi.fn(),
  SpoonacularQuotaError: class extends Error {},
  SpoonacularAuthError: class extends Error {},
  SpoonacularConfigError: class extends Error {},
}))
vi.mock('../services/groq.js', () => ({ translateRecipeContent: vi.fn() }))

describe('shoppingLists routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    mockPrisma.userLink.findFirst.mockResolvedValue(null)
  })

  it('GET / lazily creates a General list and returns caller-scoped lists', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue(null)
    mockPrisma.shoppingList.create.mockResolvedValue({ id: 'l1', name: 'General', ownerId: 'user_1', isGeneral: true })
    mockPrisma.shoppingList.findMany.mockResolvedValue([{ id: 'l1', name: 'General', ownerId: 'user_1', isGeneral: true }])

    const res = await request(app).get('/api/pantry/shopping-lists').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.shoppingList.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isGeneral: true, ownerId: 'user_1' }) })
    )
    expect(res.body.lists).toHaveLength(1)
  })

  it('GET / does not recreate an existing General list', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'l1', isGeneral: true, ownerId: 'user_1' })
    mockPrisma.shoppingList.findMany.mockResolvedValue([])

    await request(app).get('/api/pantry/shopping-lists').set('Authorization', 'Bearer good-token')

    expect(mockPrisma.shoppingList.create).not.toHaveBeenCalled()
  })

  it('GET / returns 401 without a valid token', async () => {
    const res = await request(app).get('/api/pantry/shopping-lists')
    expect(res.status).toBe(401)
  })

  it('POST / creates a new list', async () => {
    mockPrisma.shoppingList.count.mockResolvedValue(1)
    mockPrisma.shoppingList.create.mockResolvedValue({ id: 'l2', name: 'Recipe list', ownerId: 'user_1', isGeneral: false })

    const res = await request(app)
      .post('/api/pantry/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Recipe list' })

    expect(res.status).toBe(201)
    expect(res.body.list.name).toBe('Recipe list')
  })

  it('POST / returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/pantry/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({})

    expect(res.status).toBe(400)
    expect(mockPrisma.shoppingList.create).not.toHaveBeenCalled()
  })

  it('POST / returns 400 when the caller already has MAX_LISTS_PER_USER lists', async () => {
    mockPrisma.shoppingList.count.mockResolvedValue(20)

    const res = await request(app)
      .post('/api/pantry/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'One more' })

    expect(res.status).toBe(400)
    expect(mockPrisma.shoppingList.create).not.toHaveBeenCalled()
  })

  it('PUT /:id renames an owned list', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'l1', ownerId: 'user_1', isGeneral: false })
    mockPrisma.shoppingList.update.mockResolvedValue({ id: 'l1', name: 'Renamed', ownerId: 'user_1' })

    const res = await request(app)
      .put('/api/pantry/shopping-lists/l1')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Renamed' })

    expect(res.status).toBe(200)
    expect(res.body.list.name).toBe('Renamed')
  })

  it('PUT /:id returns 404 when not owned', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/pantry/shopping-lists/l1')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Renamed' })

    expect(res.status).toBe(404)
  })

  it('DELETE /:id rejects deleting the General list', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'l1', ownerId: 'user_1', isGeneral: true })

    const res = await request(app).delete('/api/pantry/shopping-lists/l1').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(400)
    expect(mockPrisma.shoppingList.delete).not.toHaveBeenCalled()
  })

  it('DELETE /:id deletes a non-general owned list', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'l2', ownerId: 'user_1', isGeneral: false })

    const res = await request(app).delete('/api/pantry/shopping-lists/l2').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.shoppingList.delete).toHaveBeenCalledWith({ where: { id: 'l2' } })
  })

  it('DELETE /:id returns 404 when not owned', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue(null)

    const res = await request(app).delete('/api/pantry/shopping-lists/l2').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(404)
  })
})
