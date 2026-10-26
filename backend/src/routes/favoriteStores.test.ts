import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  favoriteStore: {
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

const sampleStore = { placeId: 'geo:1', name: 'Super A', type: 'supermarket', lat: -34.6, lon: -58.4 }

describe('favorite stores routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  })

  it('GET /ids returns 401 without a token', async () => {
    const res = await request(app).get('/api/favorites/stores/ids')
    expect(res.status).toBe(401)
  })

  it('GET /ids returns the caller-scoped favorite place ids', async () => {
    mockPrisma.favoriteStore.findMany.mockResolvedValue([{ placeId: 'geo:1' }, { placeId: 'geo:2' }])

    const res = await request(app).get('/api/favorites/stores/ids').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.placeIds).toEqual(['geo:1', 'geo:2'])
  })

  it('GET / returns the caller-scoped favorite store snapshots', async () => {
    mockPrisma.favoriteStore.findMany.mockResolvedValue([{ ...sampleStore, id: 'f1', ownerId: 'user_1' }])

    const res = await request(app).get('/api/favorites/stores').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].name).toBe('Super A')
  })

  it('POST / creates a new favorite store snapshot', async () => {
    mockPrisma.favoriteStore.findUnique.mockResolvedValue(null)
    mockPrisma.favoriteStore.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/favorites/stores')
      .set('Authorization', 'Bearer good-token')
      .send(sampleStore)

    expect(res.status).toBe(201)
    expect(mockPrisma.favoriteStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId_placeId: { ownerId: 'user_1', placeId: 'geo:1' } },
        create: { ownerId: 'user_1', ...sampleStore },
      }),
    )
  })

  it('POST / refreshes an existing snapshot without re-checking the cap', async () => {
    mockPrisma.favoriteStore.findUnique.mockResolvedValue({ id: 'f1', ownerId: 'user_1', ...sampleStore })

    const res = await request(app)
      .post('/api/favorites/stores')
      .set('Authorization', 'Bearer good-token')
      .send({ ...sampleStore, name: 'Super A (renamed)' })

    expect(res.status).toBe(201)
    expect(mockPrisma.favoriteStore.count).not.toHaveBeenCalled()
    expect(mockPrisma.favoriteStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { name: 'Super A (renamed)', type: 'supermarket', lat: -34.6, lon: -58.4 } }),
    )
  })

  it('POST / returns 400 once MAX_FAVORITE_STORES_PER_USER is reached for a new store', async () => {
    mockPrisma.favoriteStore.findUnique.mockResolvedValue(null)
    mockPrisma.favoriteStore.count.mockResolvedValue(30)

    const res = await request(app)
      .post('/api/favorites/stores')
      .set('Authorization', 'Bearer good-token')
      .send(sampleStore)

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteStore.upsert).not.toHaveBeenCalled()
  })

  it('POST / returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/favorites/stores')
      .set('Authorization', 'Bearer good-token')
      .send({ placeId: 'geo:1' })

    expect(res.status).toBe(400)
    expect(mockPrisma.favoriteStore.upsert).not.toHaveBeenCalled()
  })

  it('DELETE /:placeId removes a favorite, scoped to the caller', async () => {
    const res = await request(app)
      .delete('/api/favorites/stores/geo:1')
      .set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.favoriteStore.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user_1', placeId: 'geo:1' },
    })
  })
})
