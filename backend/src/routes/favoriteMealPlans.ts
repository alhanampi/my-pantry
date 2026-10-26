import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import type { Prisma } from '@prisma/client'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Personal per-user cap on saved plans — DB-only content, no external cost,
// just a sane ceiling (mirrors MAX_FAVORITE_STORES_PER_USER's reasoning).
const MAX_FAVORITE_MEAL_PLANS_PER_USER = 15

// Same cap chat.ts's POST /meal-plan enforces on live plans — restoring a
// favorite creates one of those, so it has to respect the same ceiling.
const MAX_MEAL_PLANS_PER_USER = 10

function defaultName(weekStart: Date): string {
  return `Semana del ${weekStart.toLocaleDateString('es-AR', { timeZone: 'UTC' })}`
}

// GET /api/favorites/meal-plans/source-ids — cheap, DB-only. Lets Mealprep
// show "already favorited" for the plan currently on screen without
// fetching every snapshot's full content.
router.get('/source-ids', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteMealPlan.findMany({
      where: { ownerId: req.clerkUserId!, sourceMealPlanId: { not: null } },
      select: { sourceMealPlanId: true },
    })
    res.json({ sourceMealPlanIds: favorites.map((f) => f.sourceMealPlanId as string) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/favorites/meal-plans — the saved snapshots, each with its days,
// for the Favorites tab.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favoriteMealPlan.findMany({
      where: { ownerId: req.clerkUserId! },
      orderBy: { createdAt: 'desc' },
      include: { days: { orderBy: { dayOfWeek: 'asc' } } },
    })
    res.json({ results: favorites })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/favorites/meal-plans { mealPlanId, name? } — snapshots the
// user's own live MealPlan (ownership checked, 404 otherwise). Not a
// toggle/upsert like FavoriteStore's — each call saves a new, independent
// copy, since re-favoriting "the current plan" after it's been refined is a
// meaningfully different snapshot.
router.post(
  '/',
  requireAuth,
  [
    body('mealPlanId').isString().trim().notEmpty(),
    body('name').optional().isString().trim().isLength({ max: 80 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const ownerId = req.clerkUserId!
      const { mealPlanId, name } = req.body as { mealPlanId: string; name?: string }

      const mealPlan = await prisma.mealPlan.findFirst({
        where: { id: mealPlanId, ownerId },
        include: { days: true },
      })
      if (!mealPlan) {
        res.status(404).json({ error: 'Meal plan not found' })
        return
      }

      const count = await prisma.favoriteMealPlan.count({ where: { ownerId } })
      if (count >= MAX_FAVORITE_MEAL_PLANS_PER_USER) {
        res.status(400).json({ error: 'Maximum number of favorite meal plans reached' })
        return
      }

      const favorite = await prisma.favoriteMealPlan.create({
        data: {
          ownerId,
          name: name && name.length > 0 ? name : defaultName(mealPlan.weekStart),
          sourceMealPlanId: mealPlan.id,
          dietaryRestrictions: mealPlan.dietaryRestrictions,
          servings: mealPlan.servings,
          includeBreakfast: mealPlan.includeBreakfast,
          batchPrepPlan: (mealPlan.batchPrepPlan ?? undefined) as Prisma.InputJsonValue | undefined,
          days: {
            create: mealPlan.days.map((d) => ({
              dayOfWeek: d.dayOfWeek,
              mealType: d.mealType,
              title: d.title,
              description: d.description,
              image: d.image,
              ingredients: d.ingredients as unknown as Prisma.InputJsonValue,
              steps: d.steps,
              notes: d.notes,
              prepTimeMinutes: d.prepTimeMinutes,
              totalTimeMinutes: d.totalTimeMinutes,
            })),
          },
        },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } },
      })

      res.status(201).json({ favoriteMealPlan: favorite })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// DELETE /api/favorites/meal-plans/:id — idempotent.
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.favoriteMealPlan.deleteMany({
      where: { ownerId: req.clerkUserId!, id: req.params.id },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/favorites/meal-plans/:id/restore — recreates a live MealPlan
// from the snapshot (no AI call) and makes it the new "current" plan
// (MealPlan.current is just "most recently created", see chat.ts).
router.post('/:id/restore', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.clerkUserId!
    const favorite = await prisma.favoriteMealPlan.findFirst({
      where: { id: req.params.id, ownerId },
      include: { days: true },
    })
    if (!favorite) {
      res.status(404).json({ error: 'Favorite meal plan not found' })
      return
    }

    const count = await prisma.mealPlan.count({ where: { ownerId } })
    if (count >= MAX_MEAL_PLANS_PER_USER) {
      res.status(400).json({ error: 'Maximum number of meal plans reached' })
      return
    }

    const mealPlan = await prisma.mealPlan.create({
      data: {
        ownerId,
        weekStart: new Date(),
        dietaryRestrictions: favorite.dietaryRestrictions,
        servings: favorite.servings,
        includeBreakfast: favorite.includeBreakfast,
        batchPrepPlan: (favorite.batchPrepPlan ?? undefined) as Prisma.InputJsonValue | undefined,
        days: {
          create: favorite.days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            mealType: d.mealType,
            title: d.title,
            description: d.description,
            image: d.image,
            ingredients: d.ingredients as unknown as Prisma.InputJsonValue,
            steps: d.steps,
            notes: d.notes,
            prepTimeMinutes: d.prepTimeMinutes,
            totalTimeMinutes: d.totalTimeMinutes,
          })),
        },
      },
      include: { days: { orderBy: { dayOfWeek: 'asc' } } },
    })

    res.status(201).json({ mealPlan })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
