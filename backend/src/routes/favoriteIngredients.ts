import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Personal per-user cap — generous since this is just saved strings, no
// hydration cost involved (mirrors the spirit of MAX_FAVORITES_PER_USER in
// recipeFavorites.ts, just a bigger number since there's nothing to hydrate).
const MAX_FAVORITE_INGREDIENTS_PER_USER = 50

// GET /api/favorites/ingredients — the saved names themselves; there's no
// separate "ids" endpoint like recipes have, since the name IS the value.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteIngredient.findMany({
      where: { ownerId: req.clerkUserId! },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ names: favorites.map((f) => f.name) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/favorites/ingredients { name } — idempotent (upsert).
router.post(
  '/',
  requireAuth,
  [body('name').isString().trim().isLength({ min: 1, max: 60 })],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const ownerId = req.clerkUserId!
      const count = await prisma.favoriteIngredient.count({ where: { ownerId } })
      if (count >= MAX_FAVORITE_INGREDIENTS_PER_USER) {
        res.status(400).json({ error: 'Maximum number of favorite ingredients reached' })
        return
      }
      const { name } = req.body as { name: string }
      await prisma.favoriteIngredient.upsert({
        where: { ownerId_name: { ownerId, name } },
        create: { ownerId, name },
        update: {},
      })
      res.status(201).json({ success: true })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// DELETE /api/favorites/ingredients/:name — idempotent, :name URL-encoded by
// the client since it's arbitrary free text.
router.delete('/:name', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.favoriteIngredient.deleteMany({
      where: { ownerId: req.clerkUserId!, name: req.params.name },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
