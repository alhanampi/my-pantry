import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import { Prisma } from '@prisma/client'
import prisma from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import {
  streamChatReply,
  extractSearchCriteria,
  translateIngredientNames,
  mapDietaryRestrictionsToSpoonacularDiet,
  resolveUnitSystem,
  ChatConfigError,
  ChatQuotaError,
  type ChatHistoryMessage,
} from '../services/chatAssistant.js'
import { buildGeoHint, type GeoLocation } from '../services/geoContext.js'
import { searchRecipesWithFallback } from '../services/spoonacular.js'
import {
  serializeCard,
  searchWithEdamamSupplement,
  handleSpoonacularError,
} from '../services/recipeSerializers.js'
import {
  generateMealPlan,
  refineMealPlan,
  swapMeal,
  resolveMealImage,
  type GeneratedMealPlan,
  type GeneratedDay,
  type GeneratedMeal,
  type MealIngredient,
} from '../services/mealPlanAi.js'

const router = Router()

const MAX_CONVERSATIONS_PER_USER = 20
const MAX_MESSAGES_PER_CONVERSATION = 60
const MAX_MESSAGE_LENGTH = 2000
const SUGGESTION_COUNT = 3
// The Recetas tab's "based on your pantry" section always shows exactly 4
// cards (product decision, see RecipesView's PantryAndRandomSuggestions) —
// kept separate from SUGGESTION_COUNT so the in-chat "suggest a recipe"
// flow isn't affected by that choice.
const PANTRY_SECTION_SUGGESTION_COUNT = 4
const MAX_PANTRY_ITEMS_IN_PROMPT = 15
const PANTRY_SUGGESTION_INGREDIENT_COUNT = 5
const MEAL_PLAN_DEFAULT_DAYS = 7
const MAX_MEAL_PLANS_PER_USER = 10

// Reused by both the chat system prompt (1b) and the pantry-suggestion
// endpoint below — soonest-to-expire items first, so both surfaces bias
// toward using up what's about to go bad.
async function loadPantryNames(ownerId: string, take: number): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { ownerId },
    orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take,
    select: { name: true },
  })
  return products.map((p) => p.name)
}

// Chat conversations are personal, not shared with a linked partner via
// accessibleUserIds — same reasoning as FavoriteRecipe: a personal AI
// conversation isn't shared household data.

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase()
}

// Best-effort leading-number parse for Product.quantity, a free-text field
// (e.g. "2 kg", "un paquete de fideos"). Returns null when there's no
// leading number to read — callers then keep the shopping-list line rather
// than guessing the pantry already covers it (product decision: never
// silently assume "already have enough" from unparseable text).
function parseLeadingQuantity(quantity: string): number | null {
  const match = quantity.trim().match(/^(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return parseFloat(match[1].replace(',', '.'))
}

interface ConsolidatedLine {
  name: string
  amount: number
  unit: string
  // True when a pantry item matched this ingredient by name but its
  // quantity couldn't be parsed — the line stays on the list (not dropped)
  // but the frontend shows a "you may already have some" note instead of
  // silently trusting an unreadable quantity.
  pantryNote: boolean
}

// Unions ingredients across every meal in the plan (grouped by normalized
// name + unit — mismatched units for the same ingredient are kept as
// separate lines rather than unit-converted, to avoid an incorrect
// conversion table), then subtracts what's already in the pantry by exact
// normalized-name match. Runs backend-side because only the backend has
// live Product rows via Prisma.
function consolidateIngredients(
  meals: { ingredients: MealIngredient[] }[],
  pantryProducts: { name: string; quantity: string }[],
): ConsolidatedLine[] {
  const unionMap = new Map<string, ConsolidatedLine>()
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const unit = ing.unit.trim()
      const key = `${normalizeIngredientName(ing.name)}|${unit.toLowerCase()}`
      const existing = unionMap.get(key)
      if (existing) existing.amount += ing.amount
      else unionMap.set(key, { name: ing.name, amount: ing.amount, unit, pantryNote: false })
    }
  }

  const pantryQuantitiesByName = new Map<string, string[]>()
  for (const product of pantryProducts) {
    const key = normalizeIngredientName(product.name)
    const list = pantryQuantitiesByName.get(key) ?? []
    list.push(product.quantity)
    pantryQuantitiesByName.set(key, list)
  }

  const result: ConsolidatedLine[] = []
  for (const line of unionMap.values()) {
    const pantryQuantities = pantryQuantitiesByName.get(normalizeIngredientName(line.name))
    if (!pantryQuantities || pantryQuantities.length === 0) {
      result.push(line)
      continue
    }

    let hasUnparseable = false
    let remaining = line.amount
    for (const q of pantryQuantities) {
      const parsed = parseLeadingQuantity(q)
      if (parsed === null) hasUnparseable = true
      else remaining -= parsed
    }

    if (hasUnparseable) {
      // Can't confidently compute partial coverage when even one matching
      // pantry entry has an unreadable quantity — keep the full original
      // amount, flagged, rather than a partially-trusted number.
      result.push({ ...line, pantryNote: true })
    } else if (remaining > 0) {
      result.push({ ...line, amount: remaining })
    }
    // remaining <= 0 and every match was parseable: fully covered, drop it.
  }

  return result
}

// Flattens a generated week into one row per (day, mealType), resolving a
// best-effort real photo per meal by title (see mealPlanAi.ts's
// resolveMealImage) before persisting. Run in parallel — up to 21 lookups
// for a full week with breakfast, each independently fail-soft.
async function buildMealPlanEntryRows(days: GeneratedDay[]) {
  const flat: { dayOfWeek: number; mealType: 'breakfast' | 'lunch' | 'dinner'; meal: GeneratedMeal }[] = []
  for (const day of days) {
    if (day.breakfast) flat.push({ dayOfWeek: day.dayOfWeek, mealType: 'breakfast', meal: day.breakfast })
    flat.push({ dayOfWeek: day.dayOfWeek, mealType: 'lunch', meal: day.lunch })
    flat.push({ dayOfWeek: day.dayOfWeek, mealType: 'dinner', meal: day.dinner })
  }

  return Promise.all(
    flat.map(async ({ dayOfWeek, mealType, meal }) => ({
      dayOfWeek,
      mealType,
      title: meal.title,
      description: meal.description,
      image: await resolveMealImage(meal.title),
      ingredients: meal.ingredients as unknown as Prisma.InputJsonValue,
      steps: meal.steps,
      notes: meal.notes,
      prepTimeMinutes: meal.prepTimeMinutes,
      totalTimeMinutes: meal.totalTimeMinutes,
    })),
  )
}

// Inverse of buildMealPlanEntryRows — rebuilds the GeneratedMealPlan shape
// mealPlanAi.ts's refineMealPlan expects from what's already stored, so a
// refine request has the same "current plan" context the user is looking
// at, not just their new free-text message in isolation.
function entriesToGeneratedPlan(
  entries: {
    dayOfWeek: number
    mealType: string
    title: string
    description: string
    ingredients: Prisma.JsonValue
    steps: string[]
    notes: string
    prepTimeMinutes: number | null
    totalTimeMinutes: number | null
  }[],
  batchPrepPlan: Prisma.JsonValue,
): GeneratedMealPlan {
  const dayMap = new Map<number, Partial<GeneratedDay> & { dayOfWeek: number }>()
  for (const e of entries) {
    const meal: GeneratedMeal = {
      title: e.title,
      description: e.description,
      ingredients: (e.ingredients as unknown as MealIngredient[]) ?? [],
      steps: e.steps,
      notes: e.notes,
      prepTimeMinutes: e.prepTimeMinutes ?? 15,
      totalTimeMinutes: e.totalTimeMinutes ?? 30,
    }
    const day = dayMap.get(e.dayOfWeek) ?? { dayOfWeek: e.dayOfWeek }
    if (e.mealType === 'breakfast') day.breakfast = meal
    else if (e.mealType === 'dinner') day.dinner = meal
    else day.lunch = meal
    dayMap.set(e.dayOfWeek, day)
  }

  const days = Array.from(dayMap.values())
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((d) => ({ dayOfWeek: d.dayOfWeek, breakfast: d.breakfast, lunch: d.lunch!, dinner: d.dinner! }))

  return {
    days,
    batchPrepPlan: (batchPrepPlan as unknown as GeneratedMealPlan['batchPrepPlan']) ?? {
      menu: [],
      totalQuantities: [],
      sharedComponents: [],
      cookingOrder: [],
      storageNotes: '',
      estimatedTotalMinutes: 60,
    },
  }
}

// ChatConfigError/ChatQuotaError come from the same Groq client the chat
// assistant uses (mealPlanAi.ts re-exports the same error classes) — mapped
// the same way the streaming chat route maps them, since a meal-plan
// generation/refinement failure needs the same distinction surfaced to the
// user (missing API key vs. quota exceeded vs. a generic failure).
function respondMealPlanAiError(err: unknown, res: Response): boolean {
  if (err instanceof ChatConfigError) {
    res.status(500).json({ error: 'configError' })
    return true
  }
  if (err instanceof ChatQuotaError) {
    res.status(503).json({ error: 'quotaExceeded' })
    return true
  }
  return false
}

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

// Pantry-aware suggestions shown when the Chat tab is entered, before any
// conversation exists — separate from suggest-recipe (which reads an
// existing conversation's transcript) since there's nothing to read yet
// here. Ranks by soonest-to-expire, translates to English (Spoonacular only
// indexes English — see translateIngredientNames's own comment), then
// reuses the same search + serialize pipeline as suggest-recipe.
router.post(
  '/pantry-suggestions',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const pantryNames = await loadPantryNames(req.clerkUserId!, PANTRY_SUGGESTION_INGREDIENT_COUNT)
      if (pantryNames.length === 0) {
        res.json({ recipes: [] })
        return
      }

      const englishNames = await translateIngredientNames(pantryNames)
      const lang = req.query.lang === 'es' ? 'es' : 'en'

      const result = await searchRecipesWithFallback(
        { includeIngredients: englishNames.join(',') },
        PANTRY_SECTION_SUGGESTION_COUNT,
      )

      const supplemented = await searchWithEdamamSupplement(
        result,
        { includeIngredients: englishNames.join(',') },
        PANTRY_SECTION_SUGGESTION_COUNT,
      )

      const recipes = await Promise.all(supplemented.recipes.map((r) => serializeCard(r, lang)))
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

      // Read from the account's own DB row, not the request body — a global
      // preference like this shouldn't be trustable from the client, unlike
      // language (which is just "what to reply in", not account state).
      const user = await prisma.user.findUnique({
        where: { id: req.clerkUserId! },
        select: { unitSystem: true },
      })
      const unitSystem = resolveUnitSystem(user?.unitSystem, language)

      const pantryNames = await loadPantryNames(req.clerkUserId!, MAX_PANTRY_ITEMS_IN_PROMPT)
      const pantrySummary = pantryNames.length > 0 ? pantryNames.join(', ') : undefined

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
          unitSystem,
          nearbyStoresSummary,
          pantrySummary,
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
  [
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }),
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

      const history: ChatHistoryMessage[] = conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const { location } = req.body as { location?: GeoLocation }
      const geoHint = buildGeoHint(location)

      // Always attempts a search, however little the conversation has
      // covered — "suggest a recipe" is a "give me options now" action, not
      // gated on an information threshold. extractSearchCriteria may return
      // an empty object; searchRecipesWithFallback still returns real
      // (randomly-sorted) results in that case, and progressively relaxes
      // the extracted criteria if the fuller combination comes back empty.
      const criteria = await extractSearchCriteria(history, geoHint)

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

      const supplemented = await searchWithEdamamSupplement(
        result,
        { query: criteria.query, includeIngredients: criteria.includeIngredients },
        SUGGESTION_COUNT,
      )

      const recipes = await Promise.all(supplemented.recipes.map((r) => serializeCard(r, lang)))
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

// ── Weekly meal plan (Mealprep tab) ─────────────────────────────────────────
// A MealPlan is a week of day slots, each holding a full AI-generated
// recipe (title/ingredients/steps/notes/times) rather than a bookmark onto
// an external provider id — see mealPlanAi.ts and the MealPlanEntry comment
// in schema.prisma for why.

router.post(
  '/meal-plan',
  requireAuth,
  [
    body('dietaryRestrictions').isArray().withMessage('dietaryRestrictions must be an array'),
    body('dietaryRestrictions.*').isString().trim().isLength({ min: 1, max: 40 }),
    body('servings').isInt({ min: 1, max: 20 }).withMessage('servings must be between 1 and 20').toInt(),
    body('daysCount').optional().isInt({ min: 1, max: 7 }).toInt(),
    body('includeBreakfast').optional().isBoolean().toBoolean(),
    body('timeAvailableMinutes').optional().isInt({ min: 5, max: 240 }).toInt(),
    body('ingredientsOnHand').optional().isArray({ max: 30 }),
    body('ingredientsOnHand.*').isString().trim().isLength({ min: 1, max: 60 }),
    body('weekStart').optional().isISO8601().withMessage('weekStart must be a valid date'),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const ownerId = req.clerkUserId!
      const count = await prisma.mealPlan.count({ where: { ownerId } })
      if (count >= MAX_MEAL_PLANS_PER_USER) {
        res.status(400).json({ error: 'Maximum number of meal plans reached' })
        return
      }

      const {
        dietaryRestrictions,
        servings,
        daysCount = MEAL_PLAN_DEFAULT_DAYS,
        includeBreakfast = false,
        timeAvailableMinutes,
        ingredientsOnHand = [],
        weekStart,
        location,
      } = req.body as {
        dietaryRestrictions: string[]
        servings: number
        daysCount?: number
        includeBreakfast?: boolean
        timeAvailableMinutes?: number
        ingredientsOnHand?: string[]
        weekStart?: string
        location?: GeoLocation
      }

      const lang = req.query.lang === 'es' ? 'es' : 'en'
      const user = await prisma.user.findUnique({ where: { id: ownerId }, select: { unitSystem: true } })
      const unitSystem = resolveUnitSystem(user?.unitSystem, lang)
      const geoHint = buildGeoHint(location)

      const generated = await generateMealPlan({
        dietaryRestrictions,
        servings,
        includeBreakfast,
        timeAvailableMinutes,
        ingredientsOnHand,
        geoHint,
        unitSystem,
        language: lang,
        daysCount,
      })
      const entryRows = await buildMealPlanEntryRows(generated.days)

      const mealPlan = await prisma.mealPlan.create({
        data: {
          ownerId,
          weekStart: weekStart ? new Date(weekStart) : new Date(),
          dietaryRestrictions,
          servings,
          includeBreakfast,
          batchPrepPlan: generated.batchPrepPlan as unknown as Prisma.InputJsonValue,
          days: { create: entryRows },
        },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } },
      })

      res.status(201).json({ mealPlan })
    } catch (err) {
      if (respondMealPlanAiError(err, res)) return
      res.status(500).json({ error: 'Server error' })
    }
  },
)

router.get('/meal-plan/current', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { ownerId: req.clerkUserId! },
      orderBy: { createdAt: 'desc' },
      include: { days: { orderBy: { dayOfWeek: 'asc' } } },
    })
    res.json({ mealPlan })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Free-text adjustment to an existing plan — re-generates the full week
// (not a partial diff) so the model can keep the whole plan coherent, then
// swaps out all of that MealPlan's entries for the new ones.
router.post(
  '/meal-plan/:id/refine',
  requireAuth,
  [
    body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Invalid message'),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const existing = await prisma.mealPlan.findFirst({
        where: { id: req.params.id, ownerId: req.clerkUserId! },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } },
      })
      if (!existing) {
        res.status(404).json({ error: 'Meal plan not found' })
        return
      }

      const { message, location } = req.body as { message: string; location?: GeoLocation }
      const lang = req.query.lang === 'es' ? 'es' : 'en'
      const user = await prisma.user.findUnique({
        where: { id: req.clerkUserId! },
        select: { unitSystem: true },
      })
      const unitSystem = resolveUnitSystem(user?.unitSystem, lang)
      const geoHint = buildGeoHint(location)

      const currentPlan = entriesToGeneratedPlan(existing.days, existing.batchPrepPlan)
      const daysCount = new Set(existing.days.map((d) => d.dayOfWeek)).size || MEAL_PLAN_DEFAULT_DAYS

      const refined = await refineMealPlan(currentPlan, message, {
        dietaryRestrictions: existing.dietaryRestrictions,
        servings: existing.servings,
        includeBreakfast: existing.includeBreakfast,
        geoHint,
        unitSystem,
        language: lang,
        daysCount,
      })
      const entryRows = await buildMealPlanEntryRows(refined.days)

      const mealPlan = await prisma.$transaction(async (tx) => {
        await tx.mealPlanEntry.deleteMany({ where: { mealPlanId: existing.id } })
        return tx.mealPlan.update({
          where: { id: existing.id },
          data: {
            batchPrepPlan: refined.batchPrepPlan as unknown as Prisma.InputJsonValue,
            days: { create: entryRows },
          },
          include: { days: { orderBy: { dayOfWeek: 'asc' } } },
        })
      })

      res.json({ mealPlan })
    } catch (err) {
      if (respondMealPlanAiError(err, res)) return
      res.status(500).json({ error: 'Server error' })
    }
  },
)

// Replaces a single meal (e.g. the user doesn't want the suggested Tuesday
// lunch) without touching the rest of the week — cheaper than /refine and
// keeps the other days' content exactly as-is. Doesn't update
// batchPrepPlan: it may reference the swapped-out dish afterward, a known
// trade-off (see mealPlanAi.ts's swapMeal comment) rather than regenerating
// the whole week's prep plan for one swap.
router.post(
  '/meal-plan/:id/swap-meal',
  requireAuth,
  [
    body('dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('Invalid dayOfWeek').toInt(),
    body('mealType').isIn(['breakfast', 'lunch', 'dinner']).withMessage('Invalid mealType'),
    body('reason').optional().isString().trim().isLength({ max: 300 }),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }
    try {
      const existing = await prisma.mealPlan.findFirst({
        where: { id: req.params.id, ownerId: req.clerkUserId! },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } },
      })
      if (!existing) {
        res.status(404).json({ error: 'Meal plan not found' })
        return
      }

      const { dayOfWeek, mealType, reason, location } = req.body as {
        dayOfWeek: number
        mealType: 'breakfast' | 'lunch' | 'dinner'
        reason?: string
        location?: GeoLocation
      }

      const target = existing.days.find((d) => d.dayOfWeek === dayOfWeek && d.mealType === mealType)
      if (!target) {
        res.status(404).json({ error: 'Meal not found in this plan' })
        return
      }

      const lang = req.query.lang === 'es' ? 'es' : 'en'
      const user = await prisma.user.findUnique({
        where: { id: req.clerkUserId! },
        select: { unitSystem: true },
      })
      const unitSystem = resolveUnitSystem(user?.unitSystem, lang)
      const geoHint = buildGeoHint(location)
      const otherTitlesInPlan = existing.days.filter((d) => d.id !== target.id).map((d) => d.title)

      const replacement = await swapMeal({
        dietaryRestrictions: existing.dietaryRestrictions,
        servings: existing.servings,
        includeBreakfast: existing.includeBreakfast,
        geoHint,
        unitSystem,
        language: lang,
        dayOfWeek,
        mealType,
        excludeTitle: target.title,
        otherTitlesInPlan,
        reason,
      })
      const image = await resolveMealImage(replacement.title)

      const updated = await prisma.mealPlanEntry.update({
        where: { id: target.id },
        data: {
          title: replacement.title,
          description: replacement.description,
          image,
          ingredients: replacement.ingredients as unknown as Prisma.InputJsonValue,
          steps: replacement.steps,
          notes: replacement.notes,
          prepTimeMinutes: replacement.prepTimeMinutes,
          totalTimeMinutes: replacement.totalTimeMinutes,
        },
      })

      res.json({ entry: updated })
    } catch (err) {
      if (respondMealPlanAiError(err, res)) return
      res.status(500).json({ error: 'Server error' })
    }
  },
)

router.delete('/meal-plan/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.mealPlan.findFirst({
      where: { id: req.params.id, ownerId: req.clerkUserId! },
    })
    if (!existing) {
      res.status(404).json({ error: 'Meal plan not found' })
      return
    }
    await prisma.mealPlan.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Computes the consolidated remainder only — does not create the
// ShoppingList/ShoppingItem rows itself. Creating those stays client-side
// (apiCreateShoppingList + apiCreateShoppingItem), mirroring how
// sendRecipeToShoppingList already works in usePantry.ts, so this endpoint's
// only job is the part that genuinely needs server-side data: live pantry
// quantities via Prisma.
router.post(
  '/meal-plan/:id/consolidate',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const mealPlan = await prisma.mealPlan.findFirst({
        where: { id: req.params.id, ownerId: req.clerkUserId! },
        include: { days: true },
      })
      if (!mealPlan) {
        res.status(404).json({ error: 'Meal plan not found' })
        return
      }

      const meals = mealPlan.days.map((d) => ({
        ingredients: (d.ingredients as unknown as MealIngredient[]) ?? [],
      }))
      const pantryProducts = await prisma.product.findMany({
        where: { ownerId: req.clerkUserId! },
        select: { name: true, quantity: true },
      })

      const consolidated = consolidateIngredients(meals, pantryProducts)
      res.json({
        items: consolidated.map((line) => ({
          name: line.name,
          quantity: `${Math.round(line.amount * 100) / 100} ${line.unit}`.trim(),
          pantryNote: line.pantryNote,
        })),
      })
    } catch {
      res.status(500).json({ error: 'Server error' })
    }
  },
)

export default router
