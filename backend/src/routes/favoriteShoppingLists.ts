import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Mirrors MAX_LISTS_PER_USER in shoppingLists.ts — a bookmark per list isn't
// expensive, but there's no reason to let it grow past the number of lists
// that can actually exist.
const MAX_FAVORITE_SHOPPING_LISTS_PER_USER = 20

// A shopping list can be shared with a linked partner (unlike every other
// Favorites domain) — accessibleUserIds mirrors shoppingLists.ts's own
// ownership check, so a partner with access to a shared list can favorite it
// too. The bookmark itself stays personal either way (ownerId is the
// favoriter, not the list's own ownerId).
async function accessibleUserIds(userId: string): Promise<string[]> {
  const link = await prisma.userLink.findFirst({
    where: { OR: [{ userId }, { partnerId: userId }] },
  })
  if (!link) return [userId]
  const partnerId = link.userId === userId ? link.partnerId : link.userId
  return [userId, partnerId]
}

// GET /api/favorites/shopping-lists/ids — cheap, DB-only.
router.get('/ids', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteShoppingList.findMany({
      where: { ownerId: req.clerkUserId! },
      select: { listId: true },
    })
    res.json({ listIds: favorites.map((f) => f.listId) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/favorites/shopping-lists — hydrated with each list's own
// name/isGeneral/item count. Unlike FavoriteRecipe, the list itself lives in
// this same DB (no external provider to re-hydrate from), so this is a
// direct join rather than a per-item network call.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteShoppingList.findMany({
      where: { ownerId: req.clerkUserId! },
      orderBy: { createdAt: 'desc' },
      include: { list: { include: { _count: { select: { items: true } } } } },
    })
    const results = favorites.map((f) => ({
      id: f.list.id,
      name: f.list.name,
      isGeneral: f.list.isGeneral,
      itemCount: f.list._count.items,
    }))
    res.json({ results })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/favorites/shopping-lists { listId } — idempotent (upsert).
router.post(
  '/',
  requireAuth,
  [body('listId').isString().trim().notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const ownerId = req.clerkUserId!
      const { listId } = req.body as { listId: string }

      const ids = await accessibleUserIds(ownerId)
      const list = await prisma.shoppingList.findFirst({ where: { id: listId, ownerId: { in: ids } } })
      if (!list) {
        res.status(404).json({ error: 'Shopping list not found' })
        return
      }

      const existing = await prisma.favoriteShoppingList.findUnique({
        where: { ownerId_listId: { ownerId, listId } },
      })
      if (!existing) {
        const count = await prisma.favoriteShoppingList.count({ where: { ownerId } })
        if (count >= MAX_FAVORITE_SHOPPING_LISTS_PER_USER) {
          res.status(400).json({ error: 'Maximum number of favorite shopping lists reached' })
          return
        }
      }

      await prisma.favoriteShoppingList.upsert({
        where: { ownerId_listId: { ownerId, listId } },
        create: { ownerId, listId },
        update: {},
      })
      res.status(201).json({ success: true })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// DELETE /api/favorites/shopping-lists/:listId — idempotent.
router.delete('/:listId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.favoriteShoppingList.deleteMany({
      where: { ownerId: req.clerkUserId!, listId: req.params.listId },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
