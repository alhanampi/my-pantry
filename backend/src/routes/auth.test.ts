import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { verifyToken } from '@clerk/backend'
import app from '../app'

const mockPrisma = vi.hoisted(() => ({
  user: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  userLink: { findFirst: vi.fn(), create: vi.fn() },
  linkInvitation: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}))

const mockClerkGetUser = vi.hoisted(() => vi.fn())

vi.mock('../db/index.js', () => ({ default: mockPrisma }))
vi.mock('../db', () => ({ default: mockPrisma }))
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({ users: { getUser: mockClerkGetUser } })),
}))
vi.mock('../services/email.js', () => ({ sendLinkInvitation: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../services/webpush.js', () => ({ sendPush: vi.fn() }))

function authed() {
  return request(app).get('/api/auth/me').set('Authorization', 'Bearer good-token')
}

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
    mockPrisma.userLink.findFirst.mockResolvedValue(null)
  })

  describe('POST /api/auth/sync', () => {
    it('upserts the user and returns it with the resolved partner', async () => {
      mockClerkGetUser.mockResolvedValue({
        username: 'pat',
        firstName: null,
        emailAddresses: [{ id: 'e1', emailAddress: 'pat@example.com' }],
        primaryEmailAddressId: 'e1',
      })
      mockPrisma.user.upsert.mockResolvedValue({ id: 'user_1', username: 'pat', email: 'pat@example.com' })

      const res = await request(app).post('/api/auth/sync').set('Authorization', 'Bearer good-token')

      expect(res.status).toBe(200)
      expect(res.body.user).toMatchObject({ username: 'pat', partner: null })
    })

    it('returns 409 on a unique-constraint violation (username taken)', async () => {
      mockClerkGetUser.mockResolvedValue({
        username: 'pat',
        emailAddresses: [],
        primaryEmailAddressId: null,
      })
      mockPrisma.user.upsert.mockRejectedValue({ code: 'P2002' })

      const res = await request(app).post('/api/auth/sync').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns the user with partner info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', username: 'pat' })
      const res = await authed()
      expect(res.status).toBe(200)
      expect(res.body.user.username).toBe('pat')
    })

    it('returns 404 when the user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const res = await authed()
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/auth/me', () => {
    const patch = (body: Record<string, unknown>) =>
      request(app).patch('/api/auth/me').set('Authorization', 'Bearer good-token').send(body)

    it('updates the unit system preference and returns the user with partner info', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user_1', username: 'pat', unitSystem: 'imperial' })
      const res = await patch({ unitSystem: 'imperial' })
      expect(res.status).toBe(200)
      expect(res.body.user).toMatchObject({ unitSystem: 'imperial', partner: null })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { unitSystem: 'imperial' },
      })
    })

    it('rejects a value other than metric/imperial', async () => {
      const res = await patch({ unitSystem: 'bogus' })
      expect(res.status).toBe(400)
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('rejects a missing unitSystem', async () => {
      const res = await patch({})
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/link', () => {
    const send = (username: string) =>
      request(app).post('/api/auth/link').set('Authorization', 'Bearer good-token').send({ username })

    it('creates an invitation and returns the confirm url', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user_1', username: 'me' }) // self lookup
        .mockResolvedValueOnce({ id: 'user_2', username: 'pat', email: 'pat@example.com' }) // recipient lookup
      mockPrisma.linkInvitation.findFirst.mockResolvedValue(null)
      mockPrisma.linkInvitation.create.mockResolvedValue({ id: 'inv1' })

      const res = await send('pat')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ sent: true, recipientUsername: 'pat' })
      expect(res.body.confirmUrl).toContain('inv1')
    })

    it('rejects linking to yourself', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1', username: 'me' })
      const res = await send('me')
      expect(res.status).toBe(400)
    })

    it('rejects when the caller already has a partner', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1', username: 'me' })
      mockPrisma.userLink.findFirst.mockResolvedValue({ userId: 'user_1', partner: { id: 'user_9', username: 'other' } })
      const res = await send('pat')
      expect(res.status).toBe(409)
    })

    it('returns 404 when the recipient does not exist', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user_1', username: 'me' })
        .mockResolvedValueOnce(null)
      const res = await send('ghost')
      expect(res.status).toBe(404)
    })

    it('rejects a duplicate pending invitation', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user_1', username: 'me' })
        .mockResolvedValueOnce({ id: 'user_2', username: 'pat' })
      mockPrisma.linkInvitation.findFirst.mockResolvedValue({ id: 'existing' })
      const res = await send('pat')
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/auth/invite/pending', () => {
    it('lists the caller pending invites', async () => {
      mockPrisma.linkInvitation.findMany.mockResolvedValue([
        { id: 'inv1', sender: { username: 'sam' }, expiresAt: new Date('2026-01-01') },
      ])
      const res = await request(app).get('/api/auth/invite/pending').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(200)
      expect(res.body.invites).toEqual([{ token: 'inv1', senderUsername: 'sam', expiresAt: '2026-01-01T00:00:00.000Z' }])
    })
  })

  describe('GET /api/auth/invite/:token', () => {
    it('returns invite details for the recipient', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        recipientId: 'user_1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10_000),
        sender: { username: 'sam' },
      })
      const res = await request(app).get('/api/auth/invite/inv1').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(200)
      expect(res.body.senderUsername).toBe('sam')
    })

    it('returns 404 when the invite is for a different recipient', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({ id: 'inv1', recipientId: 'other-user', status: 'pending', expiresAt: new Date(Date.now() + 10_000) })
      const res = await request(app).get('/api/auth/invite/inv1').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(404)
    })

    it('returns 410 when the invite has expired', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        recipientId: 'user_1',
        status: 'pending',
        expiresAt: new Date(Date.now() - 10_000),
        sender: { username: 'sam' },
      })
      const res = await request(app).get('/api/auth/invite/inv1').set('Authorization', 'Bearer good-token')
      expect(res.status).toBe(410)
    })
  })

  describe('POST /api/auth/invite/confirm', () => {
    const confirm = (token: string) =>
      request(app).post('/api/auth/invite/confirm').set('Authorization', 'Bearer good-token').send({ token })

    it('accepts the invite and links the accounts', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        senderId: 'user_2',
        recipientId: 'user_1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10_000),
      })
      mockPrisma.userLink.findFirst.mockResolvedValue(null)
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const res = await confirm('inv1')

      expect(res.status).toBe(200)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('marks an expired invite as expired and returns 410', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        senderId: 'user_2',
        recipientId: 'user_1',
        status: 'pending',
        expiresAt: new Date(Date.now() - 10_000),
      })
      const res = await confirm('inv1')
      expect(res.status).toBe(410)
      expect(mockPrisma.linkInvitation.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { status: 'expired' } })
    })

    it('rejects when either account already has a partner', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        senderId: 'user_2',
        recipientId: 'user_1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10_000),
      })
      mockPrisma.userLink.findFirst.mockResolvedValue({ userId: 'user_2', partner: { id: 'someone', username: 'other' } })
      const res = await confirm('inv1')
      expect(res.status).toBe(409)
    })
  })

  describe('POST /api/auth/invite/decline', () => {
    it('declines a pending invite addressed to the caller', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({ id: 'inv1', recipientId: 'user_1', status: 'pending' })
      const res = await request(app).post('/api/auth/invite/decline').set('Authorization', 'Bearer good-token').send({ token: 'inv1' })
      expect(res.status).toBe(200)
      expect(mockPrisma.linkInvitation.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { status: 'declined' } })
    })

    it('returns 404 for an invite not addressed to the caller', async () => {
      mockPrisma.linkInvitation.findUnique.mockResolvedValue({ id: 'inv1', recipientId: 'someone-else', status: 'pending' })
      const res = await request(app).post('/api/auth/invite/decline').set('Authorization', 'Bearer good-token').send({ token: 'inv1' })
      expect(res.status).toBe(404)
    })
  })
})
