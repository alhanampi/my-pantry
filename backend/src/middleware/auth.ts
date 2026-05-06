import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '@clerk/backend'

declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const token = authHeader.slice(7)
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    req.clerkUserId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
