import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Personal per-user cap, mirrors MAX_FAVORITES_PER_USER in recipeFavorites.ts
// — no hydration cost here (it's a snapshot, not a bookmark), so this is
// just a sane ceiling rather than a cost-control measure.
const MAX_FAVORITE_STORES_PER_USER = 30

// GET /api/favorites/stores/ids — cheap, DB-only. Used to mark the heart on
// stores currently being browsed in NearbyStores without needing the full
// snapshot rows.
router.get('/ids', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteStore.findMany({
      where: { ownerId: req.clerkUserId! },
      select: { placeId: true },
    })
    res.json({ placeIds: favorites.map((f) => f.placeId) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/favorites/stores — the saved snapshots themselves, for the
// Favorites tab.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteStore.findMany({
      where: { ownerId: req.clerkUserId! },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ results: favorites })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/favorites/stores { placeId, name, type, lat, lon } — idempotent
// (upsert) on the placeId; re-favoriting refreshes the snapshot in case the
// store's name/type looked different on a later search.
router.post(
  '/',
  requireAuth,
  [
    body('placeId').isString().trim().notEmpty(),
    body('name').isString().trim().isLength({ min: 1, max: 200 }),
    body('type').isString().trim().isLength({ min: 1, max: 60 }),
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lon').isFloat({ min: -180, max: 180 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const ownerId = req.clerkUserId!
      const { placeId, name, type, lat, lon } = req.body as {
        placeId: string
        name: string
        type: string
        lat: number
        lon: number
      }
      const existing = await prisma.favoriteStore.findUnique({
        where: { ownerId_placeId: { ownerId, placeId } },
      })
      if (!existing) {
        const count = await prisma.favoriteStore.count({ where: { ownerId } })
        if (count >= MAX_FAVORITE_STORES_PER_USER) {
          res.status(400).json({ error: 'Maximum number of favorite stores reached' })
          return
        }
      }
      await prisma.favoriteStore.upsert({
        where: { ownerId_placeId: { ownerId, placeId } },
        create: { ownerId, placeId, name, type, lat, lon },
        update: { name, type, lat, lon },
      })
      res.status(201).json({ success: true })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// DELETE /api/favorites/stores/:placeId — idempotent.
router.delete('/:placeId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.favoriteStore.deleteMany({
      where: { ownerId: req.clerkUserId!, placeId: req.params.placeId },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
