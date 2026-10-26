import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  shoppingList: { findFirst: vi.fn() },
  favoriteShoppingList: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

describe('favorite shopping lists routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    mockPrisma.userLink.findFirst.mockResolvedValue(null)
  })

  it('GET /ids returns 401 without a token', async () => {
    const res = await request(app).get('/api/favorites/shopping-lists/ids')
    expect(res.status).toBe(401)
  })

  it('GET /ids returns the caller-scoped favorite list ids', async () => {
    mockPrisma.favoriteShoppingList.findMany.mockResolvedValue([{ listId: 'list1' }, { listId: 'list2' }])

    const res = await request(app)
      .get('/api/favorites/shopping-lists/ids')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.listIds).toEqual(['list1', 'list2'])
  })

  it('GET / hydrates favorites with the list name, isGeneral, and item count', async () => {
    mockPrisma.favoriteShoppingList.findMany.mockResolvedValue([
      { list: { id: 'list1', name: 'Asado', isGeneral: false, _count: { items: 3 } } },
    ])

    const res = await request(app).get('/api/favorites/shopping-lists').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.results).toEqual([{ id: 'list1', name: 'Asado', isGeneral: false, itemCount: 3 }])
  })

  it('POST / creates a favorite for a list the caller owns', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'list1', ownerId: 'user_1' })
    mockPrisma.favoriteShoppingList.findUnique.mockResolvedValue(null)
    mockPrisma.favoriteShoppingList.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/favorites/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({ listId: 'list1' })

    expect(res.status).toBe(201)
    expect(mockPrisma.favoriteShoppingList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId_listId: { ownerId: 'user_1', listId: 'list1' } },
        create: { ownerId: 'user_1', listId: 'list1' },
      }),
    )
  })

  it('POST / allows favoriting a list shared by a linked partner', async () => {
    mockPrisma.userLink.findFirst.mockResolvedValue({ userId: 'partner_1', partnerId: 'user_1' })
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'list1', ownerId: 'partner_1' })
    mockPrisma.favoriteShoppingList.findUnique.mockResolvedValue(null)
    mockPrisma.favoriteShoppingList.count.mockResolvedValue(0)

    const res = await request(app)
      .post('/api/favorites/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({ listId: 'list1' })

    expect(res.status).toBe(201)
    expect(mockPrisma.shoppingList.findFirst).toHaveBeenCalledWith({
      where: { id: 'list1', ownerId: { in: ['user_1', 'partner_1'] } },
    })
  })

  it('POST / returns 404 for a list the caller has no access to', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/favorites/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({ listId: 'someone-elses-list' })

    expect(res.status).toBe(404)
    expect(mockPrisma.favoriteShoppingList.upsert).not.toHaveBeenCalled()
  })

  it('POST / returns 400 once MAX_FAVORITE_SHOPPING_LISTS_PER_USER is reached for a new favorite', async () => {
    mockPrisma.shoppingList.findFirst.mockResolvedValue({ id: 'list1', ownerId: 'user_1' })
    mockPrisma.favoriteShoppingList.findUnique.mockResolvedValue(null)
    mockPrisma.favoriteShoppingList.count.mockResolvedValue(20)

    const res = await request(app)
      .post('/api/favorites/shopping-lists')
      .set('Authorization', 'Bearer good-token')
      .send({ listId: 'list1' })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteShoppingList.upsert).not.toHaveBeenCalled()
  })

  it('DELETE /:listId removes a favorite, scoped to the caller', async () => {
    const res = await request(app)
      .delete('/api/favorites/shopping-lists/list1')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.favoriteShoppingList.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user_1', listId: 'list1' },
    })
  })
})
