import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '@clerk/backend'
import { requireAuth } from './auth'

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

function mockRes() {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('requireAuth', () => {
  const next = vi.fn() as NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when the Authorization header is missing', async () => {
    const req = { headers: {} } as Request
    const res = mockRes()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when the header does not use the Bearer scheme', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as Request
    const res = mockRes()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when verifyToken rejects', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('invalid'))
    const req = { headers: { authorization: 'Bearer bad-token' } } as Request
    const res = mockRes()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' })
    expect(next).not.toHaveBeenCalled()
  })

  it('sets req.clerkUserId and calls next() when verifyToken resolves', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_123' } as never)
    const req = { headers: { authorization: 'Bearer good-token' } } as Request
    const res = mockRes()

    await requireAuth(req, res, next)

    expect(req.clerkUserId).toBe('user_123')
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })
})
