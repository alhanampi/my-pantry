import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import {
  streamChatReply,
  extractSearchCriteria,
  mapDietaryRestrictionsToSpoonacularDiet,
  ChatConfigError,
  ChatQuotaError,
  type ChatHistoryMessage,
} from '../services/chatAssistant.js'
import { searchRecipesWithFallback } from '../services/spoonacular.js'
import { serializeCard, handleSpoonacularError } from '../services/recipeSerializers.js'

const router = Router()

const MAX_CONVERSATIONS_PER_USER = 20
const MAX_MESSAGES_PER_CONVERSATION = 60
const MAX_MESSAGE_LENGTH = 2000
const SUGGESTION_COUNT = 3

// Chat conversations are personal, not shared with a linked partner via
// accessibleUserIds — same reasoning as FavoriteRecipe: a personal AI
// conversation isn't shared household data.

function titleFromFirstMessage(content: string): string {
  const trimmed = content.trim()
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed || 'New chat'
}

router.get('/conversations', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const conversations = await prisma.chatConversation.findMany({
      where: { ownerId: req.clerkUserId! },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, dietaryRestrictions: true, servings: true, updatedAt: true },
    })
    res.json({ conversations })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post(
  '/conversations',
  requireAuth,
  [
    body('dietaryRestrictions').isArray().withMessage('dietaryRestrictions must be an array'),
    body('dietaryRestrictions.*').isString().trim().isLength({ min: 1, max: 40 }),
    body('servings').isInt({ min: 1, max: 20 }).withMessage('servings must be between 1 and 20').toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const userId = req.clerkUserId!
      const count = await prisma.chatConversation.count({ where: { ownerId: userId } })
      if (count >= MAX_CONVERSATIONS_PER_USER) {
        res.status(400).json({ error: 'Maximum number of conversations reached' })
        return
      }
      const { dietaryRestrictions, servings } = req.body as {
        dietaryRestrictions: string[]
        servings: number
      }
      const conversation = await prisma.chatConversation.create({
        data: { ownerId: userId, title: 'New chat', dietaryRestrictions, servings },
      })
      res.status(201).json({ conversation })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

router.get('/conversations/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: req.params.id, ownerId: req.clerkUserId! },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json({ conversation })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/conversations/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.chatConversation.findFirst({
      where: { id: req.params.id, ownerId: req.clerkUserId! },
    })
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    await prisma.chatConversation.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /conversations/:id/messages — streaming (SSE-style) endpoint. Not
// wrapped in the usual try/catch-then-500 pattern past the point headers are
// sent, since a mid-stream failure has to be reported as an SSE frame, not an
// HTTP status.
router.post(
  '/conversations/:id/messages',
  requireAuth,
  [
    body('content').trim().isLength({ min: 1, max: MAX_MESSAGE_LENGTH }).withMessage('Invalid message'),
    body('language').optional().isIn(['en', 'es']),
    body('nearbyStoresSummary').optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }

    try {
      const conversation = await prisma.chatConversation.findFirst({
        where: { id: req.params.id, ownerId: req.clerkUserId! },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
      }
      if (conversation.messages.length >= MAX_MESSAGES_PER_CONVERSATION) {
        res.status(400).json({ error: 'conversationTooLong' })
        return
      }

      const { content, language = 'en', nearbyStoresSummary } = req.body as {
        content: string
        language?: string
        nearbyStoresSummary?: string
      }

      // Persist the user's message before calling Groq, so a Groq failure
      // never loses what the user typed.
      await prisma.chatMessage.create({
        data: { conversationId: conversation.id, role: 'user', content },
      })
      const isFirstExchange = conversation.messages.length === 0

      const history: ChatHistoryMessage[] = [
        ...conversation.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content },
      ]

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      const writeFrame = (frame: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(frame)}\n\n`)
      }

      let fullReply = ''
      try {
        fullReply = await streamChatReply({
          history,
          language,
          dietaryRestrictions: conversation.dietaryRestrictions,
          servings: conversation.servings,
          nearbyStoresSummary,
          onToken: (token) => writeFrame({ type: 'token', value: token }),
        })
      } catch (err) {
        const message =
          err instanceof ChatConfigError ? 'configError' : err instanceof ChatQuotaError ? 'quotaExceeded' : 'generic'
        writeFrame({ type: 'error', message })
        res.end()
        return
      }

      const assistantMessage = await prisma.chatMessage.create({
        data: { conversationId: conversation.id, role: 'assistant', content: fullReply },
      })

      const dataToUpdate: { updatedAt: Date; title?: string } = { updatedAt: new Date() }
      if (isFirstExchange) dataToUpdate.title = titleFromFirstMessage(content)
      await prisma.chatConversation.update({ where: { id: conversation.id }, data: dataToUpdate })

      writeFrame({ type: 'done', messageId: assistantMessage.id, title: dataToUpdate.title })
      res.end()
    } catch {
      // Failure before headers were sent (DB error looking up the
      // conversation, etc.) — safe to respond with a normal JSON error.
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server error' })
      } else {
        res.end()
      }
    }
  },
)

router.post(
  '/conversations/:id/suggest-recipe',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const conversation = await prisma.chatConversation.findFirst({
        where: { id: req.params.id, ownerId: req.clerkUserId! },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
      }

      const history: ChatHistoryMessage[] = conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      // Always attempts a search, however little the conversation has
      // covered — "suggest a recipe" is a "give me options now" action, not
      // gated on an information threshold. extractSearchCriteria may return
      // an empty object; searchRecipesWithFallback still returns real
      // (randomly-sorted) results in that case, and progressively relaxes
      // the extracted criteria if the fuller combination comes back empty.
      const criteria = await extractSearchCriteria(history)

      const diet = mapDietaryRestrictionsToSpoonacularDiet(conversation.dietaryRestrictions)
      const lang = req.query.lang === 'es' ? 'es' : 'en'

      const result = await searchRecipesWithFallback(
        {
          query: criteria.query,
          cuisine: criteria.cuisine,
          includeIngredients: criteria.includeIngredients,
          maxReadyTime: criteria.maxReadyTime,
          diet,
        },
        SUGGESTION_COUNT,
      )

      const recipes = await Promise.all(result.results.map((r) => serializeCard(r, lang)))
      res.json({ recipes })
    } catch (err) {
      if (err instanceof ChatConfigError) {
        res.status(500).json({ error: 'configError' })
        return
      }
      if (err instanceof ChatQuotaError) {
        res.status(503).json({ error: 'quotaExceeded' })
        return
      }
      handleSpoonacularError(err, res)
    }
  },
)

export default router
