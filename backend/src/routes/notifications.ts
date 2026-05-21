import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { sendPush } from '../services/webpush.js'

const router = Router()

// ── Subscribe ─────────────────────────────────────────────────────────────────

router.post(
  '/subscribe',
  requireAuth,
  [
    body('endpoint').isURL().withMessage('Invalid endpoint'),
    body('p256dh').isString().notEmpty(),
    body('auth').isString().notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }

    try {
      const userId = req.clerkUserId!
      const { endpoint, p256dh, auth } = req.body as {
        endpoint: string
        p256dh: string
        auth: string
      }

      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { userId, endpoint, p256dh, auth },
        update: { userId, p256dh, auth },
      })

      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// ── Unsubscribe ───────────────────────────────────────────────────────────────

router.delete('/unsubscribe', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    await prisma.pushSubscription.deleteMany({ where: { userId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ── Cron: send expiry notifications ──────────────────────────────────────────
// Called by Vercel Cron (or manually). Protected by CRON_SECRET, not Clerk.

router.get('/send-expiry', async (req: Request, res: Response): Promise<void> => {
  const secret = req.headers.authorization?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const expiringProducts = await prisma.product.findMany({
      where: {
        expiryDate: { not: null, lte: sevenDaysFromNow },
      },
      include: {
        owner: {
          include: { pushSubscriptions: true },
        },
      },
    })

    // Group products by owner so we send one notification per user
    const byUser = new Map<string, { names: string[]; subs: typeof expiringProducts[0]['owner']['pushSubscriptions'] }>()
    for (const product of expiringProducts) {
      if (product.owner.pushSubscriptions.length === 0) continue
      const entry = byUser.get(product.ownerId) ?? { names: [], subs: product.owner.pushSubscriptions }
      entry.names.push(product.name)
      byUser.set(product.ownerId, entry)
    }

    const staleEndpoints: string[] = []

    for (const { names, subs } of byUser.values()) {
      const count = names.length
      const payload = {
        title: count === 1 ? '1 product expiring soon' : `${count} products expiring soon`,
        body: names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : ''),
        url: '/',
      }

      for (const sub of subs) {
        try {
          await sendPush(sub, payload)
        } catch (err: unknown) {
          // 410 Gone = subscription expired; collect for cleanup
          if (isGoneError(err)) staleEndpoints.push(sub.endpoint)
        }
      }
    }

    if (staleEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: staleEndpoints } },
      })
    }

    res.json({ sent: byUser.size, staleRemoved: staleEndpoints.length })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

function isGoneError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: number }).statusCode === 410
  )
}

export default router
