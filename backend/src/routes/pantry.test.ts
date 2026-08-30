import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  userLink: { findFirst: vi.fn() },
  product: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  shoppingItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))

// app.ts also mounts auth/notifications routes, which import services that
// touch real network clients (email, web-push) — mock those modules out so
// importing app doesn't reach for real credentials/network.
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

describe('pantry routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    mockPrisma.userLink.findFirst.mockResolvedValue(null) // no partner: accessibleUserIds === [userId]
  })

  it('GET /api/pantry/products returns the caller-scoped product list', async () => {
    const product = {
      id: 1,
      name: 'Leche',
      quantity: '1L',
      brand: '',
      purchaseDate: '',
      expiryDate: null,
      location: '',
      details: '',
      ownerId: 'user_1',
    }
    mockPrisma.product.findMany.mockResolvedValue([product])

    const res = await request(app).get('/api/pantry/products').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0].name).toBe('Leche')
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: { in: ['user_1'] } } })
    )
  })

  it('GET /api/pantry/products returns 401 without a valid token', async () => {
    const res = await request(app).get('/api/pantry/products')
    expect(res.status).toBe(401)
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled()
  })

  it('PUT /api/pantry/products/:id returns 404 when the product is not owned by the caller', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .put('/api/pantry/products/999')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Otro' })

    expect(res.status).toBe(404)
    expect(mockPrisma.product.update).not.toHaveBeenCalled()
  })
})
