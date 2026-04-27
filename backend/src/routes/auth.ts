import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import prisma from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()
const SALT_ROUNDS = 12

function signToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username may only contain letters, numbers and underscores'),
    body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    const { username, email, password } = req.body as {
      username: string
      email: string
      password: string
    }

    try {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
      const user = await prisma.user.create({
        data: { username, email, passwordHash },
        select: { id: true, username: true, email: true },
      })

      res.status(201).json({ token: signToken(user.id), user: { ...user, partner: null } })
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        res.status(409).json({ error: 'Email or username already taken' })
        return
      }
      res.status(500).json({ error: 'Server error' })
    }
  }
)

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    const { email, password } = req.body as { email: string; password: string }

    try {
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: 'Invalid credentials' })
        return
      }

      const partner = await resolvePartner(user.id)
      res.json({
        token: signToken(user.id),
        user: { id: user.id, username: user.username, email: user.email, partner },
      })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  }
)

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, createdAt: true },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const partner = await resolvePartner(user.id)
    res.json({ user: { ...user, partner } })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

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

    const userId = req.userId!
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

async function resolvePartner(userId: number): Promise<{ id: number; username: string } | null> {
  const link = await prisma.userLink.findFirst({
    where: { OR: [{ userId }, { partnerId: userId }] },
    select: {
      userId:  true,
      user:    { select: { id: true, username: true } },
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
