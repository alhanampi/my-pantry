import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const MAX_LISTS_PER_USER = 20

async function accessibleUserIds(userId: string): Promise<string[]> {
  const link = await prisma.userLink.findFirst({
    where: { OR: [{ userId }, { partnerId: userId }] },
  })
  if (!link) return [userId]
  const partnerId = link.userId === userId ? link.partnerId : link.userId
  return [userId, partnerId]
}

// Ensures the caller has at least one shopping list (their "General" list),
// lazily creating it on first access — mirrors guestStorage's lazy seed for
// guests, and covers users who signed up before shopping lists existed.
async function ensureGeneralList(userId: string): Promise<void> {
  const existing = await prisma.shoppingList.findFirst({ where: { ownerId: userId, isGeneral: true } })
  if (existing) return
  await prisma.shoppingList.create({ data: { name: 'General', ownerId: userId, isGeneral: true } })
}

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    await ensureGeneralList(userId)
    const ids = await accessibleUserIds(userId)
    const lists = await prisma.shoppingList.findMany({
      where: { ownerId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ lists })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post(
  '/',
  requireAuth,
  [body('name').trim().notEmpty().withMessage('Name is required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const userId = req.clerkUserId!
      const ids = await accessibleUserIds(userId)
      const count = await prisma.shoppingList.count({ where: { ownerId: { in: ids } } })
      if (count >= MAX_LISTS_PER_USER) {
        res.status(400).json({ error: 'Maximum number of shopping lists reached' })
        return
      }
      const { name } = req.body as { name: string }
      const list = await prisma.shoppingList.create({
        data: { name, ownerId: userId, isGeneral: false },
      })
      res.status(201).json({ list })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

router.put(
  '/:id',
  requireAuth,
  [body('name').trim().notEmpty().withMessage('Name is required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const userId = req.clerkUserId!
      const ids = await accessibleUserIds(userId)
      const existing = await prisma.shoppingList.findFirst({
        where: { id: req.params.id, ownerId: { in: ids } },
      })
      if (!existing) {
        res.status(404).json({ error: 'Shopping list not found' })
        return
      }
      const { name } = req.body as { name: string }
      const list = await prisma.shoppingList.update({ where: { id: existing.id }, data: { name } })
      res.json({ list })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const ids = await accessibleUserIds(userId)
    const existing = await prisma.shoppingList.findFirst({
      where: { id: req.params.id, ownerId: { in: ids } },
    })
    if (!existing) {
      res.status(404).json({ error: 'Shopping list not found' })
      return
    }
    if (existing.isGeneral) {
      res.status(400).json({ error: 'The general list cannot be deleted' })
      return
    }
    await prisma.shoppingList.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
