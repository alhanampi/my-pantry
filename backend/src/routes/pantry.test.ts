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

  it('scopes queries to both accounts when the caller has a linked partner', async () => {
    mockPrisma.userLink.findFirst.mockResolvedValue({ userId: 'user_1', partnerId: 'user_2' })
    mockPrisma.product.findMany.mockResolvedValue([])

    await request(app).get('/api/pantry/products').set('Authorization', 'Bearer good-token')

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: { in: ['user_1', 'user_2'] } } })
    )
  })

  it('POST /api/pantry/products creates a product for the caller', async () => {
    mockPrisma.product.create.mockResolvedValue({
      id: 1, name: 'Arroz', quantity: '1kg', brand: '', purchaseDate: '', expiryDate: null, location: '', details: '', ownerId: 'user_1',
    })

    const res = await request(app)
      .post('/api/pantry/products')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Arroz', quantity: '1kg' })

    expect(res.status).toBe(201)
    expect(res.body.product.name).toBe('Arroz')
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Arroz', ownerId: 'user_1' }) })
    )
  })

  it('POST /api/pantry/products returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/pantry/products')
      .set('Authorization', 'Bearer good-token')
      .send({ quantity: '1kg' })

    expect(res.status).toBe(400)
    expect(mockPrisma.product.create).not.toHaveBeenCalled()
  })

  it('POST /api/pantry/products accepts an empty-string expiryDate as "no date" (regression)', async () => {
    // The client always sends expiryDate: '' when the field is left blank —
    // this must not be rejected as an invalid ISO date.
    mockPrisma.product.create.mockResolvedValue({
      id: 1, name: 'Arroz', quantity: '1kg', brand: '', purchaseDate: '', expiryDate: null, location: '', details: '', ownerId: 'user_1',
    })

    const res = await request(app)
      .post('/api/pantry/products')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Arroz', quantity: '1kg', expiryDate: '' })

    expect(res.status).toBe(201)
  })

  it('POST /api/pantry/products returns 400 for a genuinely malformed expiryDate', async () => {
    const res = await request(app)
      .post('/api/pantry/products')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Arroz', quantity: '1kg', expiryDate: 'not-a-date' })

    expect(res.status).toBe(400)
    expect(mockPrisma.product.create).not.toHaveBeenCalled()
  })

  it('PUT /api/pantry/products/:id updates an owned product', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({ id: 1, ownerId: 'user_1' })
    mockPrisma.product.update.mockResolvedValue({
      id: 1, name: 'Leche descremada', quantity: '1L', brand: '', purchaseDate: '', expiryDate: null, location: '', details: '', ownerId: 'user_1',
    })

    const res = await request(app)
      .put('/api/pantry/products/1')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Leche descremada', quantity: '1L' })

    expect(res.status).toBe(200)
    expect(res.body.product.name).toBe('Leche descremada')
  })

  it('DELETE /api/pantry/products/:id deletes an owned product', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({ id: 1, ownerId: 'user_1' })

    const res = await request(app).delete('/api/pantry/products/1').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('DELETE /api/pantry/products/:id returns 404 when not owned', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null)

    const res = await request(app).delete('/api/pantry/products/999').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(404)
    expect(mockPrisma.product.delete).not.toHaveBeenCalled()
  })

  it('GET /api/pantry/shopping returns the caller-scoped shopping list', async () => {
    mockPrisma.shoppingItem.findMany.mockResolvedValue([{ id: 1, name: 'Arroz', ownerId: 'user_1' }])

    const res = await request(app).get('/api/pantry/shopping').set('Authorization', 'Bearer good-token')

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
  })

  it('POST /api/pantry/shopping creates a shopping item', async () => {
    mockPrisma.shoppingItem.create.mockResolvedValue({ id: 1, name: 'Arroz', ownerId: 'user_1' })

    const res = await request(app)
      .post('/api/pantry/shopping')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Arroz', quantity: '1kg' })

    expect(res.status).toBe(201)
    expect(res.body.item.name).toBe('Arroz')
  })

  it('POST /api/pantry/shopping accepts an empty-string expiryDate (regression)', async () => {
    // AddProductModal hides the expiry field entirely for shopping items, so
    // every shopping-item create sends expiryDate: '' — this must succeed,
    // not be rejected as an invalid ISO date (the bug the user hit: this
    // made every shopping-list addition fail, so the list stayed empty).
    mockPrisma.shoppingItem.create.mockResolvedValue({ id: 1, name: 'Pasta', ownerId: 'user_1' })

    const res = await request(app)
      .post('/api/pantry/shopping')
      .set('Authorization', 'Bearer good-token')
      .send({ name: 'Pasta', quantity: '3', brand: 'Barilla', details: '', purchaseDate: '', expiryDate: '', location: '', purchased: false })

    expect(res.status).toBe(201)
    expect(mockPrisma.shoppingItem.create).toHaveBeenCalled()
  })

  it('PUT /api/pantry/shopping/:id updates only the provided fields, including purchased', async () => {
    mockPrisma.shoppingItem.findFirst.mockResolvedValue({ id: 1, ownerId: 'user_1' })
    mockPrisma.shoppingItem.update.mockResolvedValue({ id: 1, name: 'Arroz', purchased: true, ownerId: 'user_1' })

    const res = await request(app)
      .put('/api/pantry/shopping/1')
      .set('Authorization', 'Bearer good-token')
      .send({ purchased: true })

    expect(res.status).toBe(200)
    expect(mockPrisma.shoppingItem.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { purchased: true } })
  })

  it('PUT /api/pantry/shopping/:id returns 404 when not owned', async () => {
    mockPrisma.shoppingItem.findFirst.mockResolvedValue(null)
    const res = await request(app)
      .put('/api/pantry/shopping/999')
      .set('Authorization', 'Bearer good-token')
      .send({ purchased: true })
    expect(res.status).toBe(404)
  })

  it('DELETE /api/pantry/shopping/:id deletes an owned item', async () => {
    mockPrisma.shoppingItem.findFirst.mockResolvedValue({ id: 1, ownerId: 'user_1' })
    const res = await request(app).delete('/api/pantry/shopping/1').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(mockPrisma.shoppingItem.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('DELETE /api/pantry/shopping clears purchased items in bulk', async () => {
    const res = await request(app).delete('/api/pantry/shopping').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(mockPrisma.shoppingItem.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: { in: ['user_1'] }, purchased: true },
    })
  })
})
