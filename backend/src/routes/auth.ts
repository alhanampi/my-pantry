import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { createClerkClient } from '@clerk/backend'
import prisma from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

// POST /api/auth/sync — upsert del usuario de Clerk en nuestra DB
// No confiamos en datos del cliente: los obtenemos directamente de la API de Clerk
router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const clerkId = req.clerkUserId!

    try {
      const clerkUser = await clerk.users.getUser(clerkId)
      const username =
        clerkUser.username ??
        clerkUser.firstName ??
        clerkUser.emailAddresses[0]?.emailAddress.split('@')[0] ??
        clerkId
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? ''

      const user = await prisma.user.upsert({
        where: { id: clerkId },
        create: { id: clerkId, username, email },
        update: { email, username },
      })
      const partner = await resolvePartner(clerkId)
      res.json({ user: { ...user, partner } })
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        res.status(409).json({ error: 'Username already taken' })
        return
      }
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// GET /api/auth/me — usuario actual + partner
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.clerkUserId } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const partner = await resolvePartner(req.clerkUserId!)
    res.json({ user: { ...user, partner } })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/link — vincular con otro usuario por username
router.post(
  '/link',
  requireAuth,
  [body('username').trim().notEmpty().withMessage('Username is required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    const userId = req.clerkUserId!
    const { username } = req.body as { username: string }

    try {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
      if (me?.username.toLowerCase() === username.toLowerCase()) {
        res.status(400).json({ error: 'Cannot link to yourself' })
        return
      }

      const existing = await resolvePartner(userId)
      if (existing) {
        res.status(409).json({ error: 'Already linked to another account' })
        return
      }

      const partner = await prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true },
      })
      if (!partner) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      await prisma.userLink.create({ data: { userId, partnerId: partner.id } })
      res.json({ partner })
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        res.status(409).json({ error: 'Already linked' })
        return
      }
      res.status(500).json({ error: 'Server error' })
    }
  }
)

async function resolvePartner(userId: string): Promise<{ id: string; username: string } | null> {
  const link = await prisma.userLink.findFirst({
    where: { OR: [{ userId }, { partnerId: userId }] },
    select: {
      userId: true,
      user:   { select: { id: true, username: true } },
      partner: { select: { id: true, username: true } },
    },
  })
  if (!link) return null
  return link.userId === userId ? link.partner : link.user
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

export default router
