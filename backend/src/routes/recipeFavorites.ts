import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { getRecipeInformation } from '../services/spoonacular.js'
import { serializeCard, handleSpoonacularError } from '../services/recipeSerializers.js'

const router = Router()

// Personal per-user cap, mirrors MAX_LISTS_PER_USER in shoppingLists.ts —
// keeps the hydration cost of GET / (one Spoonacular + one Groq call per
// favorite) bounded.
const MAX_FAVORITES_PER_USER = 100

// GET /api/recipes/favorites/ids — cheap, DB-only. Used to mark the heart
// icon on cards the user is currently browsing (search results, detail
// panel) without paying for a Spoonacular hydration call per card.
router.get('/ids', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteRecipe.findMany({
      where: { ownerId: req.clerkUserId! },
      select: { recipeId: true },
    })
    res.json({ ids: favorites.map((f) => f.recipeId) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/recipes/favorites — hydrated cards for the Favorites tab.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const lang = req.query.lang === 'es' ? 'es' : 'en'
    const favorites = await prisma.favoriteRecipe.findMany({
      where: { ownerId: req.clerkUserId! },
      orderBy: { createdAt: 'desc' },
    })

    const results = await Promise.all(
      favorites.map(async (f) => {
        try {
          const recipe = await getRecipeInformation(f.recipeId)
          return await serializeCard(recipe, lang as string)
        } catch {
          // A favorited recipe can 404 upstream (removed from Spoonacular's
          // catalog) — skip it rather than failing the whole list over one
          // stale bookmark.
          return null
        }
      }),
    )

    res.json({ results: results.filter((r): r is NonNullable<typeof r> => r !== null) })
  } catch (err) {
    handleSpoonacularError(err, res)
  }
})

// POST /api/recipes/favorites { recipeId } — idempotent (upsert).
router.post(
  '/',
  requireAuth,
  [body('recipeId').isInt({ min: 1 }).toInt()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const ownerId = req.clerkUserId!
      const count = await prisma.favoriteRecipe.count({ where: { ownerId } })
      if (count >= MAX_FAVORITES_PER_USER) {
        res.status(400).json({ error: 'Maximum number of favorites reached' })
        return
      }
      const { recipeId } = req.body as { recipeId: number }
      await prisma.favoriteRecipe.upsert({
        where: { ownerId_recipeId: { ownerId, recipeId } },
        create: { ownerId, recipeId },
        update: {},
      })
      res.status(201).json({ success: true })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// DELETE /api/recipes/favorites/:recipeId — idempotent.
router.delete('/:recipeId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const recipeId = parseInt(req.params.recipeId, 10)
  if (isNaN(recipeId)) {
    res.status(400).json({ error: 'Invalid recipe id' })
    return
  }
  try {
    await prisma.favoriteRecipe.deleteMany({ where: { ownerId: req.clerkUserId!, recipeId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
