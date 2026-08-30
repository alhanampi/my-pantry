import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

async function accessibleUserIds(userId: string): Promise<string[]> {
  const link = await prisma.userLink.findFirst({
    where: {
      OR: [{ userId }, { partnerId: userId }],
    },
  })
  if (!link) return [userId]
  const partnerId = link.userId === userId ? link.partnerId : link.userId
  return [userId, partnerId]
}

// Serialize a Prisma Product (expiryDate: Date | null) to the wire format the
// frontend expects (expiryDate: string — ISO date "YYYY-MM-DD" or "").
function serializeProduct(product: { expiryDate: Date | null; [key: string]: unknown }) {
  return {
    ...product,
    expiryDate: product.expiryDate ? product.expiryDate.toISOString().slice(0, 10) : '',
  }
}

// Parse an incoming expiryDate string to Date | null for Prisma writes.
function parseExpiryDate(value: string | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// ── Products ──────────────────────────────────────────────────────────────────

router.get('/products', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const ids = await accessibleUserIds(userId)
    const products = await prisma.product.findMany({
      where: { ownerId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ products: products.map(serializeProduct) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

const productFields = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('quantity').optional().isString(),
  body('brand').optional().isString(),
  body('purchaseDate').optional().isString(),
  // checkFalsy so an empty string (the client's "no date" value, sent on every
  // shopping-item create since that form hides the expiry field, and on any
  // pantry create/update where it's left blank) skips validation instead of
  // being rejected as an invalid ISO date — matches parseExpiryDate's `!value`
  // treatment of "no date provided" below.
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date format'),
  body('location').optional().isString(),
  body('details').optional().isString(),
]

router.post('/products', requireAuth, productFields, async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return
  }
  try {
    const userId = req.clerkUserId!
    const { name, quantity = '', brand = '', purchaseDate = '', expiryDate, location = '', details = '' } = req.body as Record<string, string>
    const product = await prisma.product.create({
      data: { name, quantity, brand, purchaseDate, expiryDate: parseExpiryDate(expiryDate), location, details, ownerId: userId },
    })
    res.status(201).json({ product: serializeProduct(product) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/products/:id', requireAuth, productFields, async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return
  }
  try {
    const userId = req.clerkUserId!
    const productId = parseInt(req.params.id, 10)
    const ids = await accessibleUserIds(userId)
    const existing = await prisma.product.findFirst({ where: { id: productId, ownerId: { in: ids } } })
    if (!existing) { res.status(404).json({ error: 'Product not found' }); return }
    const { name, quantity = '', brand = '', purchaseDate = '', expiryDate, location = '', details = '' } = req.body as Record<string, string>
    const product = await prisma.product.update({
      where: { id: productId },
      data: { name, quantity, brand, purchaseDate, expiryDate: parseExpiryDate(expiryDate), location, details },
    })
    res.json({ product: serializeProduct(product) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/products/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const productId = parseInt(req.params.id, 10)
    const ids = await accessibleUserIds(userId)
    const existing = await prisma.product.findFirst({ where: { id: productId, ownerId: { in: ids } } })
    if (!existing) { res.status(404).json({ error: 'Product not found' }); return }
    await prisma.product.delete({ where: { id: productId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// ── Shopping list ─────────────────────────────────────────────────────────────

router.get('/shopping', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const ids = await accessibleUserIds(userId)
    const items = await prisma.shoppingItem.findMany({
      where: { ownerId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ items })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/shopping', requireAuth, productFields, async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return
  }
  try {
    const userId = req.clerkUserId!
    const { name, quantity = '', brand = '', purchaseDate = '', expiryDate = '', location = '', details = '' } = req.body as Record<string, string>
    const item = await prisma.shoppingItem.create({
      data: { name, quantity, brand, purchaseDate, expiryDate, location, details, ownerId: userId },
    })
    res.status(201).json({ item })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/shopping/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const itemId = parseInt(req.params.id, 10)
    const ids = await accessibleUserIds(userId)
    const existing = await prisma.shoppingItem.findFirst({ where: { id: itemId, ownerId: { in: ids } } })
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return }
    const { name, quantity, brand, purchaseDate, expiryDate, location, details, purchased } = req.body as Record<string, string | boolean>
    const item = await prisma.shoppingItem.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name: name as string }),
        ...(quantity !== undefined && { quantity: quantity as string }),
        ...(brand !== undefined && { brand: brand as string }),
        ...(purchaseDate !== undefined && { purchaseDate: purchaseDate as string }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate as string }),
        ...(location !== undefined && { location: location as string }),
        ...(details !== undefined && { details: details as string }),
        ...(purchased !== undefined && { purchased: purchased as boolean }),
      },
    })
    res.json({ item })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/shopping/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const itemId = parseInt(req.params.id, 10)
    const ids = await accessibleUserIds(userId)
    const existing = await prisma.shoppingItem.findFirst({ where: { id: itemId, ownerId: { in: ids } } })
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return }
    await prisma.shoppingItem.delete({ where: { id: itemId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/shopping', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.clerkUserId!
    const ids = await accessibleUserIds(userId)
    await prisma.shoppingItem.deleteMany({ where: { ownerId: { in: ids }, purchased: true } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
