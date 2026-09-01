import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import { createClerkClient } from '@clerk/backend'
import prisma from '../db'
import { requireAuth } from '../middleware/auth'
import { sendLinkInvitation } from '../services/email'

const router = Router()
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
const APP_URL = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

// POST /api/auth/sync — upsert the Clerk user in our DB
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
  } catch (err) {
    if (isPrismaUniqueError(err)) { res.status(409).json({ error: 'Username already taken' }); return }
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.clerkUserId } })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    const partner = await resolvePartner(req.clerkUserId!)
    res.json({ user: { ...user, partner } })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/auth/me — update the caller's own profile-level preferences.
// Currently just unitSystem; kept generic-shaped (a small allowlisted body)
// rather than a one-off /unit-system route, since more account-level
// preferences of this kind are likely to follow.
router.patch(
  '/me',
  requireAuth,
  [body('unitSystem').isIn(['metric', 'imperial']).withMessage('unitSystem must be metric or imperial')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    const { unitSystem } = req.body as { unitSystem: 'metric' | 'imperial' }

    try {
      const user = await prisma.user.update({
        where: { id: req.clerkUserId! },
        data: { unitSystem },
      })
      const partner = await resolvePartner(req.clerkUserId!)
      res.json({ user: { ...user, partner } })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// POST /api/auth/link — send a pantry-sharing invitation by username
router.post(
  '/link',
  requireAuth,
  [body('username').trim().notEmpty().withMessage('Username is required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    const userId = req.clerkUserId!
    const { username } = req.body as { username: string }

    try {
      const me = await prisma.user.findUnique({ where: { id: userId } })
      if (!me) { res.status(404).json({ error: 'User not found' }); return }

      if (me.username.toLowerCase() === username.toLowerCase()) {
        res.status(400).json({ error: 'Cannot link to yourself' }); return
      }
      if (await resolvePartner(userId)) {
        res.status(409).json({ error: 'Already linked to another account' }); return
      }

      const recipient = await prisma.user.findUnique({ where: { username } })
      if (!recipient) { res.status(404).json({ error: 'User not found' }); return }

      if (await resolvePartner(recipient.id)) {
        res.status(409).json({ error: 'That user is already linked to another account' }); return
      }

      // Block duplicate invitations in either direction
      const existing = await prisma.linkInvitation.findFirst({
        where: {
          status: 'pending',
          expiresAt: { gt: new Date() },
          OR: [
            { senderId: userId, recipientId: recipient.id },
            { senderId: recipient.id, recipientId: userId },
          ],
        },
      })
      if (existing) { res.status(409).json({ error: 'Invitation already pending' }); return }

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const invite = await prisma.linkInvitation.create({
        data: { senderId: userId, recipientId: recipient.id, expiresAt },
      })

      const confirmUrl = `${APP_URL}/?invite=${invite.id}`

      // Fire-and-forget email (optional — requires RESEND_API_KEY)
      sendLinkInvitation({
        to: recipient.email,
        senderUsername: me.username,
        token: invite.id,
        appUrl: APP_URL,
      }).catch((err: unknown) => console.error('[email] send failed:', err))

      res.json({ sent: true, recipientUsername: recipient.username, confirmUrl })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// GET /api/auth/invite/pending — invitations I received that are still pending
// Must be defined BEFORE /invite/:token to avoid "pending" being matched as a token
router.get('/invite/pending', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const invites = await prisma.linkInvitation.findMany({
      where: { recipientId: req.clerkUserId!, status: 'pending', expiresAt: { gt: new Date() } },
      include: { sender: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      invites: invites.map((i) => ({
        token: i.id,
        senderUsername: i.sender.username,
        expiresAt: i.expiresAt,
      })),
    })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/auth/invite/:token — details for a specific invitation (recipient only)
router.get('/invite/:token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const invite = await prisma.linkInvitation.findUnique({
      where: { id: req.params.token },
      include: { sender: { select: { username: true } } },
    })
    if (!invite || invite.recipientId !== req.clerkUserId) {
      res.status(404).json({ error: 'Invitation not found' }); return
    }
    if (invite.status !== 'pending' || invite.expiresAt < new Date()) {
      res.status(410).json({ error: 'Invitation expired or already used' }); return
    }
    res.json({ token: invite.id, senderUsername: invite.sender.username, expiresAt: invite.expiresAt })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/invite/confirm — accept an invitation
router.post(
  '/invite/confirm',
  requireAuth,
  [body('token').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ error: 'Token required' }); return }

    const userId = req.clerkUserId!
    const { token } = req.body as { token: string }

    try {
      const invite = await prisma.linkInvitation.findUnique({ where: { id: token } })

      if (!invite || invite.status !== 'pending') {
        res.status(404).json({ error: 'Invitation not found or already used' }); return
      }
      if (invite.recipientId !== userId) {
        res.status(403).json({ error: 'This invitation is not for your account' }); return
      }
      if (invite.expiresAt < new Date()) {
        await prisma.linkInvitation.update({ where: { id: token }, data: { status: 'expired' } })
        res.status(410).json({ error: 'Invitation has expired' }); return
      }

      const [senderPartner, recipientPartner] = await Promise.all([
        resolvePartner(invite.senderId),
        resolvePartner(userId),
      ])
      if (senderPartner || recipientPartner) {
        res.status(409).json({ error: 'One of the accounts is already linked to someone else' }); return
      }

      await prisma.$transaction([
        prisma.userLink.create({ data: { userId: invite.senderId, partnerId: userId } }),
        prisma.linkInvitation.update({ where: { id: token }, data: { status: 'accepted' } }),
      ])

      const partner = await resolvePartner(userId)
      res.json({ partner })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// POST /api/auth/invite/decline — decline an invitation
router.post(
  '/invite/decline',
  requireAuth,
  [body('token').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ error: 'Token required' }); return }

    const userId = req.clerkUserId!
    const { token } = req.body as { token: string }

    try {
      const invite = await prisma.linkInvitation.findUnique({ where: { id: token } })
      if (!invite || invite.recipientId !== userId || invite.status !== 'pending') {
        res.status(404).json({ error: 'Invitation not found' }); return
      }
      await prisma.linkInvitation.update({ where: { id: token }, data: { status: 'declined' } })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  }
)

async function resolvePartner(userId: string): Promise<{ id: string; username: string } | null> {
  const link = await prisma.userLink.findFirst({
    where: { OR: [{ userId }, { partnerId: userId }] },
    select: {
      userId: true,
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
