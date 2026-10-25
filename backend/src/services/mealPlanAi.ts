import Groq from 'groq-sdk'
import { searchRecipeByTitle } from './spoonacular.js'
import { searchEdamamRecipes } from './edamam.js'
import { ChatConfigError, ChatQuotaError, type UnitSystem } from './chatAssistant.js'

// Same client/model conventions as chatAssistant.ts — own instance (not
// shared with groq.ts's fail-soft translation cache), real errors surfaced
// to the caller rather than swallowed, since a broken meal plan generation
// has to be reported to the user, not silently degraded.
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

const MODEL = 'openai/gpt-oss-120b'

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', es: 'Spanish' }

function mapGroqError(err: unknown): Error {
  const status = (err as { status?: number } | undefined)?.status
  if (status === 401 || status === 403) return new ChatConfigError()
  if (status === 429) return new ChatQuotaError()
  return err instanceof Error ? err : new Error('Groq request failed')
}

export interface MealIngredient {
  name: string
  amount: number
  unit: string
}

export interface GeneratedMeal {
  title: string
  description: string
  ingredients: MealIngredient[]
  steps: string[]
  notes: string
  prepTimeMinutes: number
  totalTimeMinutes: number
}

export interface GeneratedDay {
  dayOfWeek: number
  breakfast?: GeneratedMeal
  lunch: GeneratedMeal
  dinner: GeneratedMeal
}

// A base preparation (dough, filling, sauce, cooked grain/protein, etc.)
// that two or more of the week's dishes genuinely reuse — what makes a
// batch-prep plan actually a meal-prep plan instead of just a list of
// unrelated recipes with a shared cooking session.
export interface SharedComponent {
  name: string
  description: string
  ingredients: MealIngredient[]
  steps: string[]
  usedInDishes: string[]
}

export interface BatchPrepPlan {
  menu: string[]
  totalQuantities: MealIngredient[]
  sharedComponents: SharedComponent[]
  cookingOrder: string[]
  storageNotes: string
  estimatedTotalMinutes: number
}

export interface GeneratedMealPlan {
  days: GeneratedDay[]
  batchPrepPlan: BatchPrepPlan
}

export interface GenerateMealPlanInput {
  dietaryRestrictions: string[]
  servings: number
  includeBreakfast: boolean
  timeAvailableMinutes?: number
  ingredientsOnHand: string[]
  geoHint?: string
  unitSystem: UnitSystem
  language: string
  daysCount: number
}

function mealShapeInstructions(): string {
  return (
    'Each meal object has the shape { "title": string, "description": string, "ingredients": ' +
    '[{ "name": string, "amount": number, "unit": string }], "steps": string[], "notes": string, ' +
    '"prepTimeMinutes": number, "totalTimeMinutes": number }. "description" is a 1-2 sentence hook, ' +
    'written like a short recipe-card blurb (what it tastes like, what makes it quick/easy), not a ' +
    'restatement of the title. Every entry in "steps" must read as a complete instruction with its own ' +
    'quantities spelled out in the text (e.g. "Mix 3 tablespoons rice vinegar, 1 tablespoon sesame oil..."), ' +
    'never a bare verb phrase and never "see ingredients above". "notes" covers substitutions, variations, ' +
    'and how to store/reheat leftovers, in 1-3 sentences.'
  )
}

function buildGenerationSystemPrompt(input: GenerateMealPlanInput): string {
  const langName = LANGUAGE_NAMES[input.language] ?? 'English'
  const restrictionsText =
    input.dietaryRestrictions.length > 0 ? input.dietaryRestrictions.join(', ') : 'none specified'
  const mealsPerDay = input.includeBreakfast ? 'breakfast, lunch, and dinner' : 'lunch and dinner'

  return [
    `You are a home-cooking meal-plan generator. Respond ONLY in ${langName}. Respond ONLY with a JSON ` +
      'object, no markdown code fences, no prose outside the JSON.',
    `Plan exactly ${input.daysCount} days (dayOfWeek 0 to ${input.daysCount - 1}), each with ${mealsPerDay} ` +
      `— REAL meals a person sits down to eat, never snacks, desserts, or treats unless the user explicitly ` +
      'asked for those. Vary the meals across the week; do not repeat the same dish twice.',
    `Each meal serves ${input.servings} people.`,
    `Dietary restrictions (must be respected for every meal): ${restrictionsText}.`,
    input.timeAvailableMinutes
      ? `The user has about ${input.timeAvailableMinutes} minutes available to cook each meal — keep ` +
        '"totalTimeMinutes" at or under that for every meal, choosing simpler techniques if needed.'
      : '',
    input.ingredientsOnHand.length > 0
      ? `The user already has these ingredients on hand: ${input.ingredientsOnHand.join(', ')}. Prioritize ` +
        'recipes that use several of these, so less needs to be bought — but it is fine to also require a ' +
        'few other ingredients.'
      : '',
    input.geoHint ?? '',
    `Use the ${input.unitSystem} measurement system for every "amount"/"unit" ` +
      `(${input.unitSystem === 'metric' ? 'grams, ml, °C' : 'oz, cups, °F'}).`,
    mealShapeInstructions(),
    "This is a MEAL-PREP plan, not just a list of unrelated recipes: before finalizing the week's dishes, " +
      'actively look for realistic opportunities to reuse ONE base preparation — a dough, a filling, a ' +
      'sauce, a cooked grain, a cooked protein, a marinade — across two or more different dishes in the ' +
      'week (e.g. one dough used for empanadas, a savory pie, and bread; one filling used in a pie and in ' +
      'empanadas; one batch of cooked rice or shredded chicken used across several meals). Only do this ' +
      'when it is genuinely natural for the cuisine and ingredients involved — never force an unnatural ' +
      "combination just to share something; a week can have just one shared component, or none, if that's " +
      'realistic. When a dish uses a shared component, its own "steps" must say so explicitly (e.g. "Use ' +
      '300g of the prepared dough from your prep session, rolled out...") instead of repeating that ' +
      "component's full preparation — but the dish still has to read as complete and realistic to cook on " +
      'its own day.',
    'Every recipe must be a real, recognizable dish — or a reasonable, realistic home-cooking variation of ' +
      'one — never an invented or implausible ingredient combination. Prefer dishes genuinely common for ' +
      'the inferred region/cuisine over generic or unusual ones.',
    'Respond with a JSON object of the shape { "days": [{ "dayOfWeek": number' +
      (input.includeBreakfast ? ', "breakfast": <meal>' : '') +
      ', "lunch": <meal>, "dinner": <meal> }], "batchPrepPlan": { "menu": string[], "totalQuantities": ' +
      '[{ "name": string, "amount": number, "unit": string }], "sharedComponents": [{ "name": string, ' +
      '"description": string, "ingredients": [{ "name": string, "amount": number, "unit": string }], ' +
      '"steps": string[], "usedInDishes": string[] }], "cookingOrder": string[], "storageNotes": string, ' +
      '"estimatedTotalMinutes": number } }.',
    '"batchPrepPlan" describes ONE single cooking session (like a Sunday meal-prep session) that covers ' +
      'as much of the week as reasonably fits in one go — it does not have to cover every single meal, ' +
      'skipping anything that genuinely needs to be cooked fresh is fine and expected. "menu" lists which ' +
      'dishes from the week it covers. "totalQuantities" is the combined shopping amount needed for ' +
      'everything in that session (merge repeated ingredients into one line). "sharedComponents" lists each ' +
      'base preparation made during this session that gets reused across dishes (empty array if none this ' +
      'week) — "usedInDishes" names the exact dish titles (matching "title" in the days above) that use it. ' +
      '"cookingOrder" is an ordered list of steps for the WHOLE session — covering both making each ' +
      '"sharedComponents" entry AND any other prep-ahead work for the "menu" dishes — each step with ' +
      'quantities embedded in the text, written the way a person would actually batch-cook (e.g. "Preheat ' +
      'the oven to 200°C.", "While it heats, make the dough: ..."). "storageNotes" explains how to portion/' +
      'store what was made and how to reheat it on the days it will be eaten.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function callGroqForPlan(system: string, userMessage?: string): Promise<GeneratedMealPlan> {
  if (!groq) throw new ChatConfigError()

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        ...(userMessage ? [{ role: 'user' as const, content: userMessage }] : []),
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('Empty meal plan response')

    return validateGeneratedMealPlan(JSON.parse(raw))
  } catch (err) {
    throw mapGroqError(err)
  }
}

function coerceIngredient(raw: unknown): MealIngredient {
  const r = (raw ?? {}) as Partial<MealIngredient>
  return {
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'ingredient',
    amount: typeof r.amount === 'number' && r.amount > 0 ? r.amount : 1,
    unit: typeof r.unit === 'string' ? r.unit.trim() : '',
  }
}

function coerceMeal(raw: unknown): GeneratedMeal {
  const r = (raw ?? {}) as Partial<GeneratedMeal>
  return {
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : 'Untitled dish',
    description: typeof r.description === 'string' ? r.description.trim() : '',
    ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(coerceIngredient) : [],
    steps: Array.isArray(r.steps)
      ? r.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    notes: typeof r.notes === 'string' ? r.notes.trim() : '',
    prepTimeMinutes:
      typeof r.prepTimeMinutes === 'number' && r.prepTimeMinutes > 0
        ? Math.round(r.prepTimeMinutes)
        : 15,
    totalTimeMinutes:
      typeof r.totalTimeMinutes === 'number' && r.totalTimeMinutes > 0
        ? Math.round(r.totalTimeMinutes)
        : 30,
  }
}

function coerceSharedComponent(raw: unknown): SharedComponent {
  const r = (raw ?? {}) as Partial<SharedComponent>
  return {
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Base preparation',
    description: typeof r.description === 'string' ? r.description.trim() : '',
    ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(coerceIngredient) : [],
    steps: Array.isArray(r.steps)
      ? r.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    usedInDishes: Array.isArray(r.usedInDishes)
      ? r.usedInDishes.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
      : [],
  }
}

// Manual validate/coerce-with-fallback, same philosophy as
// extractSearchCriteria/translateIngredientNames in chatAssistant.ts — no
// schema library in this codebase, just defensive field-by-field reads so a
// slightly-off model response degrades gracefully instead of crashing.
function validateGeneratedMealPlan(parsed: unknown): GeneratedMealPlan {
  const p = (parsed ?? {}) as { days?: unknown; batchPrepPlan?: unknown }
  const rawDays = Array.isArray(p.days) ? p.days : []

  const days: GeneratedDay[] = rawDays.map((rawDay, index) => {
    const d = (rawDay ?? {}) as Partial<GeneratedDay> & { breakfast?: unknown }
    const dayOfWeek = typeof d.dayOfWeek === 'number' ? d.dayOfWeek : index
    const day: GeneratedDay = {
      dayOfWeek,
      lunch: coerceMeal(d.lunch),
      dinner: coerceMeal(d.dinner),
    }
    if (d.breakfast) day.breakfast = coerceMeal(d.breakfast)
    return day
  })

  const rawPrep = (p.batchPrepPlan ?? {}) as Partial<BatchPrepPlan>
  const batchPrepPlan: BatchPrepPlan = {
    menu: Array.isArray(rawPrep.menu)
      ? rawPrep.menu.filter((m): m is string => typeof m === 'string')
      : [],
    totalQuantities: Array.isArray(rawPrep.totalQuantities)
      ? rawPrep.totalQuantities.map(coerceIngredient)
      : [],
    sharedComponents: Array.isArray(rawPrep.sharedComponents)
      ? rawPrep.sharedComponents.map(coerceSharedComponent)
      : [],
    cookingOrder: Array.isArray(rawPrep.cookingOrder)
      ? rawPrep.cookingOrder.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0
        )
      : [],
    storageNotes: typeof rawPrep.storageNotes === 'string' ? rawPrep.storageNotes.trim() : '',
    estimatedTotalMinutes:
      typeof rawPrep.estimatedTotalMinutes === 'number' && rawPrep.estimatedTotalMinutes > 0
        ? Math.round(rawPrep.estimatedTotalMinutes)
        : 60,
  }

  return { days, batchPrepPlan }
}

export async function generateMealPlan(input: GenerateMealPlanInput): Promise<GeneratedMealPlan> {
  return callGroqForPlan(buildGenerationSystemPrompt(input))
}

export async function refineMealPlan(
  currentPlan: GeneratedMealPlan,
  refinementMessage: string,
  input: Omit<GenerateMealPlanInput, 'ingredientsOnHand' | 'timeAvailableMinutes'>
): Promise<GeneratedMealPlan> {
  const base = buildGenerationSystemPrompt({ ...input, ingredientsOnHand: [] })
  const system =
    `${base}\n\nThe user already has this week's plan (as JSON below) and wants it adjusted — keep ` +
    "whatever still fits their request and only change what the user's message actually asks for. " +
    'Return the FULL updated plan in the same JSON shape described above, for all days, not just a diff.' +
    `\n\nCurrent plan:\n${JSON.stringify(currentPlan)}`

  return callGroqForPlan(system, refinementMessage)
}

export interface SwapMealInput extends Omit<
  GenerateMealPlanInput,
  'daysCount' | 'ingredientsOnHand'
> {
  dayOfWeek: number
  mealType: 'breakfast' | 'lunch' | 'dinner'
  excludeTitle: string
  otherTitlesInPlan: string[]
  reason?: string
}

// Replaces ONE meal in an existing plan — e.g. the user doesn't like the
// suggested dish for Tuesday lunch. Deliberately a separate, narrower call
// from generateMealPlan/refineMealPlan rather than resending the whole week:
// cheaper, and the response shape is just a single meal, not the full
// {days, batchPrepPlan} structure those two share.
export async function swapMeal(input: SwapMealInput): Promise<GeneratedMeal> {
  if (!groq) throw new ChatConfigError()

  const langName = LANGUAGE_NAMES[input.language] ?? 'English'
  const restrictionsText =
    input.dietaryRestrictions.length > 0 ? input.dietaryRestrictions.join(', ') : 'none specified'

  const system = [
    `You are a home-cooking meal-plan generator. Respond ONLY in ${langName}. Respond ONLY with a JSON ` +
      'object, no markdown code fences, no prose outside the JSON.',
    `Generate ONE replacement ${input.mealType} for day ${input.dayOfWeek + 1} of this week's meal plan. ` +
      `The current recipe for that slot is "${input.excludeTitle}" and the user wants something different` +
      (input.reason ? ` for this reason: "${input.reason}".` : '.'),
    `Do not suggest "${input.excludeTitle}" again, and do not repeat any other dish already in this week's ` +
      `plan: ${input.otherTitlesInPlan.length > 0 ? input.otherTitlesInPlan.join(', ') : 'none'}.`,
    `The meal serves ${input.servings} people.`,
    `Dietary restrictions (must be respected): ${restrictionsText}.`,
    input.timeAvailableMinutes
      ? `The user has about ${input.timeAvailableMinutes} minutes available to cook — keep ` +
        '"totalTimeMinutes" at or under that, choosing simpler techniques if needed.'
      : '',
    input.geoHint ?? '',
    `Use the ${input.unitSystem} measurement system for every "amount"/"unit" ` +
      `(${input.unitSystem === 'metric' ? 'grams, ml, °C' : 'oz, cups, °F'}).`,
    mealShapeInstructions(),
    'Every recipe must be a real, recognizable dish — or a reasonable, realistic home-cooking variation of ' +
      'one — never an invented or implausible ingredient combination.',
    'Respond with a JSON object of the shape { "meal": <meal> }.',
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('Empty meal response')

    const parsed = JSON.parse(raw) as { meal?: unknown }
    return coerceMeal(parsed.meal)
  } catch (err) {
    throw mapGroqError(err)
  }
}

// Best-effort photo lookup by the AI-generated title — never throws, never
// blocks plan generation on a quota/network failure. The frontend falls
// back to a per-meal-type icon when this comes back empty (see
// MealprepRecipeDetail / WeeklyCalendar).
export async function resolveMealImage(title: string): Promise<string> {
  try {
    const spoonacular = await searchRecipeByTitle(title)
    if (spoonacular?.image) return spoonacular.image
  } catch {
    // fall through to Edamam
  }

  try {
    const [edamam] = await searchEdamamRecipes({ query: title, number: 1 })
    if (edamam?.image) return edamam.image
  } catch {
    // no image available — frontend falls back to an icon
  }

  return ''
}
