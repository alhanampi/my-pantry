import Groq from 'groq-sdk'
import { searchRecipeByTitle } from './spoonacular.js'
import { searchEdamamRecipes } from './edamam.js'
import { ChatConfigError, ChatQuotaError, translateDishTitle, type UnitSystem } from './chatAssistant.js'

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

// gpt-oss-120b's hidden reasoning (see streamChatReply's own comment in
// chatAssistant.ts) can eat so much of the completion budget on a large
// request like a full week's plan that there's little or nothing left for
// the actual JSON — response_format: json_object still closes the object
// validly, just with fewer/emptier days than asked for, so this never
// surfaces as a Groq-side error. generateMealPlan/refineMealPlan throw this
// instead of silently persisting a thin/empty plan.
export class MealPlanGenerationError extends Error {
  constructor() {
    super('Meal plan generation returned fewer days than requested')
    this.name = 'MealPlanGenerationError'
  }
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

// A base preparation decided BEFORE any full recipe is written — a cooked
// grain/legume, a protein, a sauce, a prepped vegetable, etc. — cheap and
// shared across most of the week's dishes. This is the whole point of a
// meal-prep plan (cook a handful of economical bases once, build the
// week's meals from them) rather than discovering overlaps after the fact
// once a batch of disparate recipes already exists.
export interface BaseComponentSeed {
  name: string
  ingredients: MealIngredient[]
}

// A distinct dish for the WHOLE week — not per meal slot. A real meal-prep
// plan cooks a small, fixed number of these once and eats them repeatedly
// (as leftovers) across several slots; see MenuAssignment for how slots map
// onto these.
export interface RecipeStub {
  title: string
  usesComponents: string[]
  extraIngredients: string[]
}

export interface MenuAssignment {
  dayOfWeek: number
  mealType: 'breakfast' | 'lunch' | 'dinner'
  recipeTitle: string
}

export interface MealPrepSkeleton {
  baseComponents: BaseComponentSeed[]
  recipes: RecipeStub[]
  assignments: MenuAssignment[]
}

// "steps" and "notes" are deliberately capped (3-6 / one sentence) rather
// than left open-ended — this is per-meal boilerplate multiplied across
// every single dish in the plan, so trimming it here directly reduces the
// token cost of every days-chunk call (see DAYS_CHUNK_MAX_TOKENS's own
// comment for the real per-meal token cost this was calibrated against).
function mealShapeInstructions(): string {
  return (
    'Each meal object has the shape { "title": string, "description": string, "ingredients": ' +
    '[{ "name": string, "amount": number, "unit": string }], "steps": string[], "notes": string, ' +
    '"prepTimeMinutes": number, "totalTimeMinutes": number }. "description" is a 1-2 sentence hook, ' +
    'written like a short recipe-card blurb (what it tastes like, what makes it quick/easy), not a ' +
    'restatement of the title. "steps" has 3 to 6 entries, each a complete instruction with its own ' +
    'quantities spelled out in the text (e.g. "Mix 3 tablespoons rice vinegar, 1 tablespoon sesame oil..."), ' +
    'never a bare verb phrase and never "see ingredients above" — combine smaller sub-steps into one entry ' +
    'rather than exceeding 6. "notes" is ONE short sentence covering the single most useful substitution ' +
    'or storage tip, not a full rundown.'
  )
}

// Shared by the days-chunk/refine prompts — servings/dietary/ingredients-
// on-hand/geo/unit framing is identical regardless of which days are being
// asked for. Deliberately does NOT fold in timeAvailableMinutes as a
// per-meal cap: that number represents the whole batch-cooking session's
// budget (see MealPlanGenerator.tsx), not a ceiling on each individual
// dish's own "totalTimeMinutes" — it's used instead as the target for the
// skeleton's ambition and the batch-prep session's estimatedTotalMinutes.
function commonMealInstructions(
  input: Pick<GenerateMealPlanInput, 'dietaryRestrictions' | 'servings' | 'ingredientsOnHand' | 'geoHint' | 'unitSystem'>,
): string[] {
  const restrictionsText =
    input.dietaryRestrictions.length > 0 ? input.dietaryRestrictions.join(', ') : 'none specified'

  return [
    `Each meal serves ${input.servings} people.`,
    `Dietary restrictions (must be respected for every meal): ${restrictionsText}.`,
    input.ingredientsOnHand.length > 0
      ? `The user already has these ingredients on hand: ${input.ingredientsOnHand.join(', ')}. Prioritize ` +
        'recipes that use several of these, so less needs to be bought — but it is fine to also require a ' +
        'few other ingredients.'
      : '',
    input.geoHint ?? '',
    `Use the ${input.unitSystem} measurement system for every "amount"/"unit" ` +
      `(${input.unitSystem === 'metric' ? 'grams, ml, °C' : 'oz, cups, °F'}).`,
  ]
}

function formatComponentList(baseComponents: BaseComponentSeed[]): string {
  return baseComponents
    .map((c) => `"${c.name}" (${c.ingredients.map((i) => i.name).join(', ') || 'no listed ingredients'})`)
    .join('; ')
}

// A real meal-prep session cooks a small, FIXED set of dishes once and eats
// them repeatedly across the week as leftovers — it does not invent a new
// recipe for every single meal slot. clamp(ceil(totalSlots / 3), 2, 5) aims
// for each dish being eaten roughly 3 times (e.g. 14 slots → 5 dishes, 4
// slots → 2 dishes), which is also what keeps the batch-cooking session
// (buildBatchPrepPlanSystemPrompt) and the week's total ingredient list a
// realistic size instead of scaling with the number of days.
function targetRecipeCount(totalSlots: number): number {
  return Math.min(5, Math.max(2, Math.ceil(totalSlots / 3)))
}

// Phase 0 of plan generation: decide the week's cheap, reusable base
// preparations, the small fixed set of distinct dishes built from them, and
// which meal slot eats which dish — all up front, before any full recipe is
// written. This is what makes the rest of the pipeline actually produce a
// meal-PREP plan (a handful of dishes, reused across the week) instead of
// inventing a disparate recipe per meal and only afterwards hoping some of
// them happen to overlap.
function buildMealPrepSkeletonSystemPrompt(input: GenerateMealPlanInput): string {
  const langName = LANGUAGE_NAMES[input.language] ?? 'English'
  const mealsPerDay = input.includeBreakfast ? 'breakfast, lunch, and dinner' : 'lunch and dinner'
  const totalSlots = input.daysCount * (input.includeBreakfast ? 3 : 2)
  const recipeCount = targetRecipeCount(totalSlots)

  return [
    'You are planning a real home meal-prep week — the entire point is to cook a small, FIXED number of ' +
      'dishes once and eat them repeatedly across the week as leftovers, not to invent a different recipe ' +
      `for every meal. Respond ONLY in ${langName}. Respond ONLY with a JSON object, no markdown code ` +
      'fences, no prose outside the JSON.',
    'First, decide 3 to 6 "base components" — cheap, accessible preparations (a cooked grain or legume, a ' +
      'protein, a sauce, a prepped vegetable, etc.) that will be reused across MOST of the week\'s dishes. ' +
      "Keep the week's total distinct ingredients few and inexpensive; do not pick a specialty or expensive " +
      "ingredient unless it's already in the user's ingredients-on-hand.",
    `Then decide EXACTLY ${recipeCount} distinct dish recipes for the WHOLE week — no more, no fewer — each ` +
      'built around one or more of those base components (varying how each is finished, seasoned, or ' +
      `paired so the ${recipeCount} dishes still feel different from each other). For each dish, list which ` +
      'base components it uses and, separately, any extra ingredients it needs beyond those bases (keep ' +
      'that extra list short).',
    `Finally, assign EVERY one of the week's ${totalSlots} meal slots (dayOfWeek 0 to ${input.daysCount - 1}, ` +
      `${mealsPerDay} each) to ONE of those ${recipeCount} dishes. Reusing the same dish across multiple ` +
      'slots is expected and correct — that repetition is the entire point of meal-prep, not a flaw. Spread ' +
      'the dishes across the week however feels natural (the same dish for several lunches in a row, ' +
      'alternating between two dishes, etc.) — every slot must be assigned to exactly one of the dishes.',
    !input.includeBreakfast
      ? 'Do NOT assign any breakfast slots — the user only wants lunch and dinner this week.'
      : '',
    ...commonMealInstructions(input),
    input.timeAvailableMinutes
      ? `The user wants to batch-cook everything in roughly ${input.timeAvailableMinutes} minutes in one ` +
        'sitting — size the number and complexity of base components/dishes accordingly (fewer/simpler for a ' +
        'shorter session, more for a longer one).'
      : '',
    'Dish titles must be short, simple, realistic, recognizable recipe names — the kind of thing a person ' +
      'would search for or see on a menu (e.g. "Arroz con pollo", "Lentejas guisadas"), never a stacked ' +
      'description of several ingredients joined with "and"/"with", and never with parenthetical tags.',
    'Respond with a JSON object of the shape { "baseComponents": [{ "name": string, "ingredients": ' +
      '[{ "name": string, "amount": number, "unit": string }] }], "recipes": [{ "title": string, ' +
      '"usesComponents": string[], "extraIngredients": string[] }], "assignments": [{ "dayOfWeek": number, ' +
      '"mealType": "breakfast"|"lunch"|"dinner", "recipeTitle": string }] }. Every "usesComponents" entry ' +
      'must exactly match a "baseComponents" "name", and every "assignments" "recipeTitle" must exactly ' +
      'match a "recipes" "title".',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Phase 1 (fresh generation only — see buildDaysRefineSystemPrompt for the
// refine path): writes the full recipe for each of the week's ALREADY-
// DECIDED distinct dishes, ONCE each — never per meal slot. The dish count
// is capped at 5 by the skeleton (see targetRecipeCount), so this is a
// single call instead of the chunked-by-day approach the days still need;
// which slots eat which dish is handled afterwards, in code, by
// assembleDays.
function buildRecipesSystemPrompt(
  input: GenerateMealPlanInput,
  baseComponents: BaseComponentSeed[],
  recipes: RecipeStub[],
): string {
  const langName = LANGUAGE_NAMES[input.language] ?? 'English'

  const recipesText = recipes
    .map(
      (r) =>
        `"${r.title}" — uses: ${r.usesComponents.join(', ') || 'none'}; extra ingredients: ` +
        `${r.extraIngredients.join(', ') || 'none'}`,
    )
    .join('\n')

  return [
    'You are writing the full recipe for each of this week\'s ALREADY-DECIDED distinct dishes — there are ' +
      `only ${recipes.length} of them for the whole week; every meal slot reuses one of these as leftovers, ` +
      `which is the entire point of meal-prep. Respond ONLY in ${langName}. Respond ONLY with a JSON object, ` +
      'no markdown code fences, no prose outside the JSON.',
    `This week's shared base preparations (already made ahead, in a separate batch-cooking session) are: ` +
      `${formatComponentList(baseComponents) || 'none'}.`,
    `Write the full recipe for EXACTLY these ${recipes.length} dish(es) — do not change any title, and do ` +
      `not add or remove dishes:\n${recipesText}`,
    'For each dish, build it around the base component(s) it uses plus only its listed extra ingredients — ' +
      "do not introduce other ingredients. Assume the base component(s) are already prepared: \"steps\" " +
      'should be about finishing, seasoning, combining, or reheating them for this specific dish, never ' +
      'recooking a base component from scratch.',
    ...commonMealInstructions(input),
    mealShapeInstructions(),
    'Every recipe must be a real, recognizable dish-preparation built from the base(s) you were given — a ' +
      'plausible home-cooking technique, not an invented or implausible combination.',
    `Respond with a JSON object of the shape { "recipes": [<meal>, ...] }, with exactly ${recipes.length} ` +
      'entries in the SAME order as the dishes listed above.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Phase 1 for the refine path: unlike fresh generation, a refinement edits
// an EXISTING plan — there is no fresh skeleton menu to hand it (see
// refineMealPlan's own comment on why the skeleton doesn't re-run), so this
// works from the current days' JSON instead of a pre-committed assignment
// list, while still being told about the week's existing base components
// so it keeps using them.
function buildDaysRefineSystemPrompt(
  input: GenerateMealPlanInput,
  dayOfWeekStart: number,
  dayOfWeekEnd: number,
  baseComponents: BaseComponentSeed[],
  existingDaysForChunk: GeneratedDay[],
): string {
  const langName = LANGUAGE_NAMES[input.language] ?? 'English'
  const chunkDaysCount = dayOfWeekEnd - dayOfWeekStart + 1
  const componentsText = formatComponentList(baseComponents)

  return [
    'You are adjusting part of an existing meal-prep plan based on the user\'s request, as one chunk of a ' +
      `larger ${input.daysCount}-day plan. Respond ONLY in ${langName}. Respond ONLY with a JSON object, no ` +
      'markdown code fences, no prose outside the JSON.',
    componentsText
      ? `This week's shared base preparations (already made ahead in one batch-cooking session) are: ` +
        `${componentsText}. Keep using them for the dishes that already rely on them, unless the user's ` +
        'request says otherwise.'
      : '',
    `These are the current ${chunkDaysCount} day(s) in this range (dayOfWeek ${dayOfWeekStart} to ` +
      `${dayOfWeekEnd}):\n${JSON.stringify(existingDaysForChunk)}`,
    "Keep whatever still fits the user's request and only change what their message actually asks for. " +
      'Return the FULL updated days for this range (not just the changed parts).',
    ...commonMealInstructions(input),
    mealShapeInstructions(),
    'Every recipe must be a real, recognizable dish — or a reasonable, realistic home-cooking variation of ' +
      'one — never an invented or implausible ingredient combination.',
    'Respond with a JSON object of the shape { "days": [{ "dayOfWeek": number' +
      (input.includeBreakfast ? ', "breakfast": <meal>' : '') +
      ', "lunch": <meal>, "dinner": <meal> }] }.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Phase 2: runs once, after every days-chunk has come back, instead of
// being bundled into the (much larger) days-generation call — see
// DAYS_PER_CHUNK's own comment. The base components are already decided
// (by the skeleton, or carried over from the existing plan on a refine) —
// this call's job is purely HOW to cook them and finish the week's dishes
// in one realistic, integrated session, never whether to.
function buildBatchPrepPlanSystemPrompt(
  input: Pick<GenerateMealPlanInput, 'language' | 'unitSystem' | 'timeAvailableMinutes'>,
  days: GeneratedDay[],
  baseComponents: BaseComponentSeed[],
): string {
  const langName = LANGUAGE_NAMES[input.language] ?? 'English'

  // Grouped by title rather than listed once per day/slot: with the
  // skeleton now assigning the SAME dish to several slots on purpose (real
  // meal-prep repetition — see buildMealPrepSkeletonSystemPrompt), listing
  // every occurrence separately would read like N different dishes to cook
  // and invite the model to write duplicate cooking steps for the same
  // dish. Grouping shows each distinct dish once, with where it's eaten.
  const byTitle = new Map<string, { meal: GeneratedMeal; eatenAt: string[] }>()
  for (const day of days) {
    const entries: { label: string; meal: GeneratedMeal }[] = [
      { label: `Day ${day.dayOfWeek + 1} lunch`, meal: day.lunch },
      { label: `Day ${day.dayOfWeek + 1} dinner`, meal: day.dinner },
    ]
    if (day.breakfast) entries.unshift({ label: `Day ${day.dayOfWeek + 1} breakfast`, meal: day.breakfast })
    for (const { label, meal } of entries) {
      const existing = byTitle.get(meal.title)
      if (existing) existing.eatenAt.push(label)
      else byTitle.set(meal.title, { meal, eatenAt: [label] })
    }
  }
  const mealsText = [...byTitle.values()]
    .map(
      ({ meal, eatenAt }) =>
        `"${meal.title}" — ${meal.ingredients.map((i) => i.name).join(', ')} — eaten: ${eatenAt.join(', ')}`,
    )
    .join('\n')

  const componentsText = baseComponents
    .map(
      (c) =>
        `"${c.name}" — ${c.ingredients.map((i) => `${i.amount} ${i.unit} ${i.name}`).join(', ') || 'no listed ingredients'}`,
    )
    .join('\n')

  return [
    "You are writing the single batch-cooking session for this week's meal-prep plan. Respond ONLY in " +
      `${langName}. Respond ONLY with a JSON object, no markdown code fences, no prose outside the JSON.`,
    `This week's base preparations, already decided, are:\n${componentsText || 'none'}`,
    `Here is this week's finalized meal plan (titles and ingredients):\n${mealsText}`,
    "Several of these dishes repeat across multiple days — that's intentional meal-prep repetition, not a " +
      'mistake. Cook each DISTINCT dish only ONCE in this session, not once per day it appears.',
    'Write out the full cooking method for each base preparation listed above, then ONE realistic, ordered ' +
      '"cookingOrder" for the whole session — making every base preparation AND finishing/portioning every ' +
      'dish above that uses one — the way a person actually batch-cooks, parallelizing real downtime (e.g. ' +
      '"Preheat the oven to 200°C. While it heats, ...") with quantities embedded directly in the text.',
    input.timeAvailableMinutes
      ? `The user wants this session to take roughly ${input.timeAvailableMinutes} minutes.`
      : '',
    'A realistic single meal-prep session covering multiple dishes is NEVER under 60 minutes of real ' +
      'kitchen time, and usually 90 minutes or more once several base preparations and dishes are involved — ' +
      'set "estimatedTotalMinutes" honestly on that basis; do not underestimate just to look efficient.',
    `Use the ${input.unitSystem} measurement system for every "amount"/"unit" ` +
      `(${input.unitSystem === 'metric' ? 'grams, ml, °C' : 'oz, cups, °F'}).`,
    'Respond with a JSON object of the shape { "batchPrepPlan": { "menu": string[], "totalQuantities": ' +
      '[{ "name": string, "amount": number, "unit": string }], "sharedComponents": [{ "name": string, ' +
      '"description": string, "ingredients": [{ "name": string, "amount": number, "unit": string }], ' +
      '"steps": string[], "usedInDishes": string[] }], "cookingOrder": string[], "storageNotes": string, ' +
      '"estimatedTotalMinutes": number } }. "sharedComponents" must cover every base preparation listed ' +
      'above (one entry each, "name" matching), with "usedInDishes" naming the exact dish titles (matching ' +
      'the titles listed above) that use it. "menu" lists every dish title this session covers. ' +
      '"totalQuantities" is the combined shopping amount needed for everything in the session (merge ' +
      'repeated ingredients into one line). "storageNotes" explains how to portion/store what was made and ' +
      'how to reheat it on the days it will be eaten.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Groq's response_format: json_object validates the model's own output and
// 400s with this code when it isn't syntactically valid JSON — observed in
// practice as a single stray escape character in an otherwise complete,
// correctly-sized response (e.g. "amount\":2" instead of "amount":2), not a
// structural/token-budget problem (that failure mode is MealPlanGenerationError,
// a different thing). This is a one-off generation glitch, not a
// deterministic one, so simply asking again has a good chance of succeeding.
const JSON_VALIDATE_FAILED_CODE = 'json_validate_failed'
const MAX_JSON_VALIDATION_RETRIES = 2

function isJsonValidateFailedError(err: unknown): boolean {
  const e = err as { status?: number; error?: { error?: { code?: string } } } | undefined
  return e?.status === 400 && e?.error?.error?.code === JSON_VALIDATE_FAILED_CODE
}

async function callGroqJson(system: string, userMessage: string | undefined, maxTokens: number): Promise<unknown> {
  if (!groq) throw new ChatConfigError()

  for (let attempt = 0; ; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        // Lower than the chat/swap default (0.7) — a cheap, complementary
        // lever against the json_validate_failed glitch above (on top of
        // the retry itself), while still leaving reasonable variety across
        // dishes.
        temperature: 0.5,
        // Keeps hidden-reasoning overhead small so it doesn't crowd out the
        // actual JSON — see MealPlanGenerationError's own comment above.
        reasoning_effort: 'low',
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          ...(userMessage ? [{ role: 'user' as const, content: userMessage }] : []),
        ],
      })

      const raw = completion.choices[0]?.message?.content
      if (!raw) throw new Error('Empty meal plan response')

      return JSON.parse(raw)
    } catch (err) {
      if (isJsonValidateFailedError(err) && attempt < MAX_JSON_VALIDATION_RETRIES) continue
      throw mapGroqError(err)
    }
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

function coerceBaseComponentSeed(raw: unknown): BaseComponentSeed {
  const r = (raw ?? {}) as Partial<BaseComponentSeed>
  return {
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Base preparation',
    ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(coerceIngredient) : [],
  }
}

function coerceRecipeStub(raw: unknown): RecipeStub | null {
  const r = (raw ?? {}) as Partial<RecipeStub>
  if (typeof r.title !== 'string' || !r.title.trim()) return null

  return {
    title: r.title.trim(),
    usesComponents: Array.isArray(r.usesComponents)
      ? r.usesComponents.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : [],
    extraIngredients: Array.isArray(r.extraIngredients)
      ? r.extraIngredients.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : [],
  }
}

function coerceMenuAssignment(raw: unknown): MenuAssignment | null {
  const r = (raw ?? {}) as Partial<MenuAssignment>
  if (typeof r.recipeTitle !== 'string' || !r.recipeTitle.trim()) return null
  if (typeof r.dayOfWeek !== 'number') return null
  const mealType = r.mealType === 'breakfast' || r.mealType === 'lunch' || r.mealType === 'dinner' ? r.mealType : null
  if (!mealType) return null

  return {
    dayOfWeek: Math.round(r.dayOfWeek),
    mealType,
    recipeTitle: r.recipeTitle.trim(),
  }
}

// Manual coerce-with-fallback, same philosophy as extractSearchCriteria/
// translateIngredientNames in chatAssistant.ts — no schema library in this
// codebase, just defensive field-by-field reads so a slightly-off model
// response degrades gracefully instead of crashing.
function coerceBatchPrepPlan(raw: unknown): BatchPrepPlan {
  const r = (raw ?? {}) as Partial<BatchPrepPlan>
  return {
    menu: Array.isArray(r.menu) ? r.menu.filter((m): m is string => typeof m === 'string') : [],
    totalQuantities: Array.isArray(r.totalQuantities) ? r.totalQuantities.map(coerceIngredient) : [],
    sharedComponents: Array.isArray(r.sharedComponents) ? r.sharedComponents.map(coerceSharedComponent) : [],
    cookingOrder: Array.isArray(r.cookingOrder)
      ? r.cookingOrder.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    storageNotes: typeof r.storageNotes === 'string' ? r.storageNotes.trim() : '',
    estimatedTotalMinutes:
      typeof r.estimatedTotalMinutes === 'number' && r.estimatedTotalMinutes > 0
        ? Math.round(r.estimatedTotalMinutes)
        // A real multi-dish batch-cooking session is never this quick — see
        // buildBatchPrepPlanSystemPrompt's own 60-90 minute floor guidance;
        // this fallback only kicks in when the model omitted the field
        // entirely, so it should reflect that same realistic floor, not an
        // optimistic guess.
        : 90,
  }
}

// A full week in one Groq call needs more output tokens than this account's
// per-minute budget for gpt-oss-120b actually allows (observed: Groq's own
// x-ratelimit-limit-tokens header reports 8000/min, shared with the rest of
// the app) — asking for more than that outright 400s the request before it
// generates anything (code: json_validate_failed), and even a smaller fixed
// cap just moves the failure to "a big enough request still runs out".
// Generating a few days at a time instead means each individual call's
// token need depends only on the chunk size (fixed, small), never on how
// ambitious the whole request is. Fresh generation no longer chunks by day
// (see generateRecipesForSkeleton — it writes each distinct dish once,
// capped at 5 regardless of the week's length), so DAYS_PER_CHUNK/
// DAYS_CHUNK_MAX_TOKENS are exclusively for refineMealPlan's per-day-range
// edits of an EXISTING plan now.
//
// Both numbers below are calibrated from a real truncated response: a
// DAYS_PER_CHUNK=3 chunk ran out of its old 3000-token budget partway
// through day 2, having fully generated ~3.3 meals — about 900 tokens per
// meal at this level of detail (since trimmed further, see
// mealShapeInstructions). Worst case per chunk is with breakfast enabled
// (3 meals/day): 2 days × 3 meals × 900 ≈ 5400 tokens, which DAYS_PER_CHUNK
// = 2 keeps comfortably under both DAYS_CHUNK_MAX_TOKENS and the account's
// overall 8000/min ceiling once the prompt's own input tokens are counted.
const DAYS_PER_CHUNK = 2
const DAYS_CHUNK_MAX_TOKENS = 6000
const BATCH_PREP_MAX_TOKENS = 2000
// Lightweight by design — no steps, just a handful of base-component
// ingredient lists, up to 5 recipe stubs, and one short line per meal slot
// (up to 21 for a 7-day, breakfast-included plan) — comfortably smaller
// than the recipes call despite covering the whole week's assignments.
const MEAL_PREP_SKELETON_MAX_TOKENS = 3000
// The skeleton caps distinct recipes at 5 (see targetRecipeCount), so this
// is always a single call — same per-meal token cost calibration as
// DAYS_CHUNK_MAX_TOKENS (~900 tokens/meal), 5 recipes × 900 ≈ 4500, safely
// under this ceiling.
const RECIPES_MAX_TOKENS = 6000

function dayChunkRanges(daysCount: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  for (let start = 0; start < daysCount; start += DAYS_PER_CHUNK) {
    ranges.push([start, Math.min(start + DAYS_PER_CHUNK, daysCount) - 1])
  }
  return ranges
}

async function generateMealPrepSkeleton(input: GenerateMealPlanInput): Promise<MealPrepSkeleton> {
  const parsed = (await callGroqJson(
    buildMealPrepSkeletonSystemPrompt(input),
    undefined,
    MEAL_PREP_SKELETON_MAX_TOKENS,
  )) as { baseComponents?: unknown; recipes?: unknown; assignments?: unknown }

  const baseComponents = Array.isArray(parsed.baseComponents) ? parsed.baseComponents.map(coerceBaseComponentSeed) : []
  const recipes = Array.isArray(parsed.recipes)
    ? parsed.recipes.map(coerceRecipeStub).filter((r): r is RecipeStub => r !== null)
    : []
  const assignments = Array.isArray(parsed.assignments)
    ? parsed.assignments.map(coerceMenuAssignment).filter((a): a is MenuAssignment => a !== null)
    : []

  return { baseComponents, recipes, assignments }
}

// Phase 1 for fresh generation: writes the full recipe for every distinct
// dish the skeleton decided, ONCE each, in a single call (the skeleton caps
// this at 5 dishes — see targetRecipeCount). Each returned recipe's title
// is forced back to the skeleton's own title (never trusted from the
// model's own output) for the same reason generateDaysChunk used to force
// dayOfWeek from array position: assembleDays joins assignments to recipes
// by title, and that join must never silently miss because the model
// paraphrased a title slightly.
async function generateRecipesForSkeleton(
  input: GenerateMealPlanInput,
  baseComponents: BaseComponentSeed[],
  recipes: RecipeStub[],
): Promise<Map<string, GeneratedMeal>> {
  const byTitle = new Map<string, GeneratedMeal>()
  if (recipes.length === 0) return byTitle

  const system = buildRecipesSystemPrompt(input, baseComponents, recipes)
  const parsed = (await callGroqJson(system, undefined, RECIPES_MAX_TOKENS)) as { recipes?: unknown }
  const rawRecipes = Array.isArray(parsed.recipes) ? parsed.recipes : []

  // Fewer recipes back than requested means this single call got cut short
  // — the same failure mode MealPlanGenerationError already covers for
  // days, surfaced the same way rather than silently persisting a thinner
  // menu than the skeleton committed to.
  if (rawRecipes.length < recipes.length) throw new MealPlanGenerationError()

  recipes.forEach((stub, i) => {
    const meal = coerceMeal(rawRecipes[i])
    meal.title = stub.title
    byTitle.set(stub.title, meal)
  })

  return byTitle
}

// Phase 2: no Groq call — every meal slot's recipe was already written
// once by generateRecipesForSkeleton, so repetition across the week is
// assembled directly from the skeleton's assignments. A day missing its
// lunch/dinner (or breakfast, if requested) — e.g. the skeleton assigned a
// recipeTitle that doesn't match any recipe — is dropped; assertCompleteDays
// turns that shortfall into the usual MealPlanGenerationError.
function assembleDays(
  assignments: MenuAssignment[],
  recipesByTitle: Map<string, GeneratedMeal>,
  daysCount: number,
  includeBreakfast: boolean,
): GeneratedDay[] {
  const drafts = new Map<number, Partial<GeneratedDay>>()
  for (const a of assignments) {
    if (a.dayOfWeek < 0 || a.dayOfWeek >= daysCount) continue
    const meal = recipesByTitle.get(a.recipeTitle)
    if (!meal) continue
    const draft = drafts.get(a.dayOfWeek) ?? {}
    draft[a.mealType] = meal
    drafts.set(a.dayOfWeek, draft)
  }

  const days: GeneratedDay[] = []
  for (let d = 0; d < daysCount; d++) {
    const draft = drafts.get(d)
    if (!draft?.lunch || !draft?.dinner) continue
    if (includeBreakfast && !draft.breakfast) continue
    days.push({
      dayOfWeek: d,
      lunch: draft.lunch,
      dinner: draft.dinner,
      // Gated on includeBreakfast, not just on whether the model happened
      // to assign one — nothing stops the skeleton from assigning a
      // breakfast slot the user never asked for (the prompt doesn't
      // explicitly forbid it when includeBreakfast is false, only omits
      // asking for it), so trusting draft.breakfast alone could silently
      // persist an unrequested meal.
      ...(includeBreakfast && draft.breakfast ? { breakfast: draft.breakfast } : {}),
    })
  }
  return days
}

function parseDaysChunkResponse(
  parsed: { days?: unknown },
  dayOfWeekStart: number,
  dayOfWeekEnd: number,
): GeneratedDay[] {
  const rawDays = Array.isArray(parsed.days) ? parsed.days : []

  // dayOfWeek always comes from this day's real position within the week
  // (this chunk's own offset + its position inside the chunk), never from
  // whatever number the model put in the JSON. The model occasionally
  // repeats/miscounts dayOfWeek (a plain arithmetic slip) — trusting that
  // value let two days collide on the same dayOfWeek, which then violates
  // MealPlanEntry's (mealPlanId, dayOfWeek, mealType) unique DB constraint
  // and 500s the whole request.
  //
  // The slice below guards a related case: if the model hallucinates an
  // EXTRA day object beyond what this chunk asked for (e.g. it lists the
  // same dish twice, or misreads the assignment list), that extra entry
  // would get dayOfWeekStart + localIndex pushed past dayOfWeekEnd — right
  // into the NEXT chunk's own range, causing the exact same unique-
  // constraint collision across chunks instead of within one. Capping the
  // array to this chunk's real size (dayOfWeekEnd - dayOfWeekStart + 1)
  // before assigning dayOfWeek keeps every chunk's days inside its own
  // range no matter how many the model actually returned; a chunk that
  // returns too FEW still surfaces as MealPlanGenerationError via
  // assertCompleteDays, which is the correct failure mode for that case.
  const expectedCount = dayOfWeekEnd - dayOfWeekStart + 1
  return rawDays.slice(0, expectedCount).map((rawDay, localIndex) => {
    const d = (rawDay ?? {}) as Partial<GeneratedDay> & { breakfast?: unknown }
    const day: GeneratedDay = {
      dayOfWeek: dayOfWeekStart + localIndex,
      lunch: coerceMeal(d.lunch),
      dinner: coerceMeal(d.dinner),
    }
    if (d.breakfast) day.breakfast = coerceMeal(d.breakfast)
    return day
  })
}

async function refineDaysChunk(
  input: GenerateMealPlanInput,
  dayOfWeekStart: number,
  dayOfWeekEnd: number,
  baseComponents: BaseComponentSeed[],
  existingDaysForChunk: GeneratedDay[],
  message: string,
): Promise<GeneratedDay[]> {
  const system = buildDaysRefineSystemPrompt(input, dayOfWeekStart, dayOfWeekEnd, baseComponents, existingDaysForChunk)
  const parsed = (await callGroqJson(system, message, DAYS_CHUNK_MAX_TOKENS)) as { days?: unknown }
  return parseDaysChunkResponse(parsed, dayOfWeekStart, dayOfWeekEnd)
}

async function generateBatchPrepPlanOnly(
  input: Pick<GenerateMealPlanInput, 'language' | 'unitSystem' | 'timeAvailableMinutes'>,
  days: GeneratedDay[],
  baseComponents: BaseComponentSeed[],
): Promise<BatchPrepPlan> {
  if (days.length === 0) return coerceBatchPrepPlan(undefined)

  const parsed = (await callGroqJson(
    buildBatchPrepPlanSystemPrompt(input, days, baseComponents),
    undefined,
    BATCH_PREP_MAX_TOKENS,
  )) as { batchPrepPlan?: unknown }
  return coerceBatchPrepPlan(parsed.batchPrepPlan)
}

// Fewer days back than requested means at least one chunk's response got
// cut short (see MealPlanGenerationError) — thrown here rather than inside
// generateDaysChunk, which stays purely structural/defensive and has no
// idea how many days the OVERALL plan was supposed to end up with.
function assertCompleteDays(days: GeneratedDay[], daysCount: number): void {
  if (days.length < daysCount) throw new MealPlanGenerationError()
}

export async function generateMealPlan(input: GenerateMealPlanInput): Promise<GeneratedMealPlan> {
  const skeleton = await generateMealPrepSkeleton(input)
  const recipesByTitle = await generateRecipesForSkeleton(input, skeleton.baseComponents, skeleton.recipes)

  const days = assembleDays(skeleton.assignments, recipesByTitle, input.daysCount, input.includeBreakfast)
  assertCompleteDays(days, input.daysCount)

  const batchPrepPlan = await generateBatchPrepPlanOnly(input, days, skeleton.baseComponents)
  return { days, batchPrepPlan }
}

export async function refineMealPlan(
  currentPlan: GeneratedMealPlan,
  refinementMessage: string,
  input: Omit<GenerateMealPlanInput, 'ingredientsOnHand' | 'timeAvailableMinutes'>
): Promise<GeneratedMealPlan> {
  const fullInput: GenerateMealPlanInput = { ...input, ingredientsOnHand: [] }

  // Deliberately does NOT re-run generateMealPrepSkeleton: a targeted
  // refinement ("less spicy", "swap the chicken for tofu") shouldn't
  // reinvent the whole week's base preparations from scratch. Instead, the
  // CURRENT plan's own batch-prep components (if any) are carried forward
  // as fixed context, so the refined days keep relying on the same bases
  // unless the user's message says otherwise.
  const baseComponents: BaseComponentSeed[] = (currentPlan.batchPrepPlan?.sharedComponents ?? []).map((c) => ({
    name: c.name,
    ingredients: c.ingredients,
  }))

  const days: GeneratedDay[] = []
  for (const [start, end] of dayChunkRanges(input.daysCount)) {
    const existingDaysForChunk = currentPlan.days.filter((d) => d.dayOfWeek >= start && d.dayOfWeek <= end)
    const chunkDays = await refineDaysChunk(fullInput, start, end, baseComponents, existingDaysForChunk, refinementMessage)
    days.push(...chunkDays)
  }
  assertCompleteDays(days, input.daysCount)

  const batchPrepPlan = await generateBatchPrepPlanOnly(fullInput, days, baseComponents)
  return { days, batchPrepPlan }
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
      reasoning_effort: 'low',
      max_tokens: 1200,
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
//
// Spoonacular/Edamam only index English text (same constraint documented on
// chatAssistant.ts's extractSearchCriteria/translateIngredientNames) —
// titles here are generated in the plan's own language, so a non-English
// title is translated first. Translation failure falls back to searching
// with the original title rather than skipping the lookup entirely, same
// best-effort philosophy as the rest of this function.
export async function resolveMealImage(title: string, language: string): Promise<string> {
  let searchTitle = title
  if (language !== 'en') {
    try {
      searchTitle = await translateDishTitle(title)
    } catch {
      // fall through with the original (likely non-English) title
    }
  }

  try {
    const spoonacular = await searchRecipeByTitle(searchTitle)
    if (spoonacular?.image) return spoonacular.image
  } catch {
    // fall through to Edamam
  }

  try {
    const [edamam] = await searchEdamamRecipes({ query: searchTitle, number: 1 })
    if (edamam?.image) return edamam.image
  } catch {
    // no image available — frontend falls back to an icon
  }

  return ''
}
