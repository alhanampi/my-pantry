import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  favoriteIngredient: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

describe('favorite ingredients routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  })

  it('GET / returns 401 without a token', async () => {
    const res = await request(app).get('/api/favorites/ingredients')
    expect(res.status).toBe(401)
  })

  it('GET / returns the caller-scoped favorite ingredient names', async () => {
    mockPrisma.favoriteIngredient.findMany.mockResolvedValue([{ name: 'palta' }, { name: 'sin maní' }])

    const res = await request(app).get('/api/favorites/ingredients').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.names).toEqual(['palta', 'sin maní'])
    expect(mockPrisma.favoriteIngredient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } }),
    )
  })

  it('POST / upserts a favorite ingredient', async () => {
    mockPrisma.favoriteIngredient.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/favorites/ingredients')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'palta' })

    expect(res.status).toBe(201)
    expect(mockPrisma.favoriteIngredient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId_name: { ownerId: 'user_1', name: 'palta' } },
        create: { ownerId: 'user_1', name: 'palta' },
      }),
    )
  })

  it('POST / returns 400 for an empty name', async () => {
    const res = await request(app)
      .post('/api/favorites/ingredients')
      .set('Authorization', 'Bearer good-token')
      .send({ name: '' })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteIngredient.upsert).not.toHaveBeenCalled()
  })

  it('POST / returns 400 once MAX_FAVORITE_INGREDIENTS_PER_USER is reached', async () => {
    mockPrisma.favoriteIngredient.count.mockResolvedValue(50)

    const res = await request(app)
      .post('/api/favorites/ingredients')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'palta' })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteIngredient.upsert).not.toHaveBeenCalled()
  })

  it('DELETE /:name removes a favorite, scoped to the caller', async () => {
    const res = await request(app)
      .delete('/api/favorites/ingredients/palta')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.favoriteIngredient.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user_1', name: 'palta' },
    })
  })
})
