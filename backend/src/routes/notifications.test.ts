import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'
import { sendPush } from '../services/webpush.js'

const mockPrisma = vi.hoisted(() => ({
  pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
  product: { findMany: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('../db', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({})),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn() }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

describe('notifications routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    process.env.CRON_SECRET = 'test_cron_secret'
  })

  describe('POST /api/notifications/subscribe', () => {
    it('upserts the subscription', async () => {
      const res = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', 'Bearer good-token')
        .send({ endpoint: 'https://push.example.com/1', p256dh: 'p', auth: 'a' })

      expect(res.status).toBe(200)
      expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { endpoint: 'https://push.example.com/1' } })
      )
    })

    it('returns 400 for an invalid endpoint', async () => {
      const res = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', 'Bearer good-token')
        .send({ endpoint: 'not-a-url', p256dh: 'p', auth: 'a' })

      expect(res.status).toBe(400)
      expect(mockPrisma.pushSubscription.upsert).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/notifications/unsubscribe', () => {
    it('deletes the caller subscriptions', async () => {
      const res = await request(app).delete('/api/notifications/unsubscribe').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(200)
      expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } })
    })
  })

  describe('GET /api/notifications/send-expiry', () => {
    it('returns 401 without the correct cron secret', async () => {
      const res = await request(app).get('/api/notifications/send-expiry').set('Authorization', 'Bearer wrong')
      expect(res.status).toBe(401)
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled()
    })

    it('groups expiring products by owner and sends one push per user', async () => {
      const sub = { endpoint: 'https://push/1', p256dh: 'p', auth: 'a' }
      mockPrisma.product.findMany.mockResolvedValue([
        { name: 'Leche', ownerId: 'user_1', owner: { pushSubscriptions: [sub] } },
        { name: 'Yogur', ownerId: 'user_1', owner: { pushSubscriptions: [sub] } },
      ])

      const res = await request(app).get('/api/notifications/send-expiry').set('Authorization', 'Bearer test_cron_secret')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ sent: 1, staleRemoved: 0 })
      expect(sendPush).toHaveBeenCalledTimes(1)
      expect(sendPush).toHaveBeenCalledWith(sub, expect.objectContaining({ title: '2 products expiring soon' }))
    })

    it('skips owners with no push subscriptions', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { name: 'Leche', ownerId: 'user_1', owner: { pushSubscriptions: [] } },
      ])

      const res = await request(app).get('/api/notifications/send-expiry').set('Authorization', 'Bearer test_cron_secret')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ sent: 0, staleRemoved: 0 })
      expect(sendPush).not.toHaveBeenCalled()
    })

    it('removes stale (410 Gone) subscriptions after a failed send', async () => {
      const staleSub = { endpoint: 'https://push/stale', p256dh: 'p', auth: 'a' }
      mockPrisma.product.findMany.mockResolvedValue([
        { name: 'Leche', ownerId: 'user_1', owner: { pushSubscriptions: [staleSub] } },
      ])
      vi.mocked(sendPush).mockRejectedValueOnce({ statusCode: 410 })

      const res = await request(app).get('/api/notifications/send-expiry').set('Authorization', 'Bearer test_cron_secret')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ sent: 1, staleRemoved: 1 })
      expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: { in: [staleSub.endpoint] } } })
    })
  })
})
