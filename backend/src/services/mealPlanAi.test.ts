import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateMealPlan, refineMealPlan, swapMeal, resolveMealImage, type GeneratedMealPlan } from './mealPlanAi'

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

const mockSearchRecipeByTitle = vi.hoisted(() => vi.fn())
vi.mock('./spoonacular.js', () => ({ searchRecipeByTitle: mockSearchRecipeByTitle }))

const mockSearchEdamamRecipes = vi.hoisted(() => vi.fn())
vi.mock('./edamam.js', () => ({ searchEdamamRecipes: mockSearchEdamamRecipes }))

function completion(content: unknown) {
  return { choices: [{ message: { content: JSON.stringify(content) } }] }
}

function jsonValidateFailedError() {
  return Object.assign(new Error('400 Failed to generate JSON'), {
    status: 400,
    error: { error: { message: 'Failed to generate JSON', type: 'invalid_request_error', code: 'json_validate_failed' } },
  })
}

function validMeal(title: string) {
  return {
    title,
    description: `${title} description`,
    ingredients: [{ name: 'rice', amount: 200, unit: 'g' }],
    steps: [`Cook ${title} with the rice.`],
    notes: 'Keeps for 3 days in the fridge.',
    prepTimeMinutes: 10,
    totalTimeMinutes: 25,
  }
}

type MealType = 'breakfast' | 'lunch' | 'dinner'

// generateMealPlan's phase-0 skeleton call: a small fixed set of distinct
// dish stubs plus the full week's slot-by-slot assignment to them (see
// mealPlanAi.ts's MealPrepSkeleton) — the ONLY place dayOfWeek/mealType
// assignments come from for fresh generation.
function skeleton(
  recipes: { title: string; usesComponents?: string[]; extraIngredients?: string[] }[],
  assignments: { dayOfWeek: number; mealType: MealType; recipeTitle: string }[],
  baseComponents: unknown[] = [],
) {
  return completion({
    baseComponents,
    recipes: recipes.map((r) => ({ usesComponents: [], extraIngredients: [], ...r })),
    assignments,
  })
}

const baseInput = {
  dietaryRestrictions: [] as string[],
  servings: 2,
  includeBreakfast: false,
  ingredientsOnHand: [] as string[],
  unitSystem: 'metric' as const,
  language: 'en',
  daysCount: 2,
}

describe('generateMealPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
  })

  // generateMealPlan is now a fixed 3-call pipeline: the skeleton decides a
  // small set of distinct dishes and assigns every slot to one of them, a
  // single call writes each dish's full recipe ONCE, and assembleDays (no
  // Groq call) repeats that same recipe object into every slot that
  // references it — which is what guarantees the repetition is exact.
  it('returns the parsed days and batchPrepPlan, repeating the same dish across the days that share it', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
            { dayOfWeek: 1, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 1, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))
      .mockResolvedValueOnce(
        completion({
          batchPrepPlan: {
            menu: ['Lunch A', 'Dinner A'],
            totalQuantities: [{ name: 'rice', amount: 400, unit: 'g' }],
            cookingOrder: ['Preheat the oven to 200°C.'],
            storageNotes: 'Store in airtight containers.',
            estimatedTotalMinutes: 90,
          },
        }),
      )

    const result = await generateMealPlan(baseInput)

    expect(result.days).toHaveLength(2)
    expect(result.days[0].lunch.title).toBe('Lunch A')
    expect(result.days[1].lunch.title).toBe('Lunch A')
    expect(result.days[0].breakfast).toBeUndefined()
    expect(result.batchPrepPlan.storageNotes).toBe('Store in airtight containers.')
  })

  // Regression test for the 400 "json_validate_failed" error: Groq rejects
  // a request outright when max_tokens exceeds the account's per-minute
  // budget (observed: 8000 tokens/min for this model). Every call this
  // service makes — skeleton, recipes, or batchPrepPlan — must stay safely
  // under that, regardless of how many days/meals the overall plan asks
  // for.
  it('sets a low reasoning effort and keeps every call safely under the account token-rate ceiling', async () => {
    mockCreate.mockResolvedValue(
      completion({
        baseComponents: [],
        recipes: [validMeal('Lunch A'), validMeal('Dinner A')],
        assignments: [
          { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
          { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
          { dayOfWeek: 1, mealType: 'lunch', recipeTitle: 'Lunch A' },
          { dayOfWeek: 1, mealType: 'dinner', recipeTitle: 'Dinner A' },
        ],
        batchPrepPlan: {},
      }),
    )

    await generateMealPlan(baseInput)

    for (const [call] of mockCreate.mock.calls) {
      expect(call.reasoning_effort).toBe('low')
      expect(call.max_tokens).toBeGreaterThan(0)
      expect(call.max_tokens).toBeLessThan(8000)
    }
  })

  // Regression test for a second, distinct failure mode: Groq's own
  // response_format: json_object validation occasionally rejects an
  // otherwise complete, correctly-sized response over a single stray
  // escape character the model slipped in (400, code: json_validate_failed)
  // — a one-off generation glitch, not a structural/budget problem, so
  // simply retrying the same request should resolve it on its own. The
  // retry lives in callGroqJson, shared by every phase.
  it('retries once on a json_validate_failed error and succeeds without surfacing it', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
            { dayOfWeek: 1, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 1, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockRejectedValueOnce(jsonValidateFailedError())
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    const result = await generateMealPlan(baseInput)

    expect(mockCreate).toHaveBeenCalledTimes(4)
    expect(result.days).toHaveLength(2)
  })

  it('gives up after exhausting retries on repeated json_validate_failed errors', async () => {
    mockCreate.mockRejectedValue(jsonValidateFailedError())

    await expect(generateMealPlan(baseInput)).rejects.toThrow()
    // 1 initial attempt + 2 retries = 3 calls (all on the skeleton call,
    // the first thing generateMealPlan does), then gives up instead of
    // retrying forever.
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('does not retry other kinds of Groq errors (e.g. a real quota error)', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }))

    const { ChatQuotaError } = await import('./chatAssistant')
    await expect(generateMealPlan(baseInput)).rejects.toBeInstanceOf(ChatQuotaError)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  // Regression test: the skeleton is the only source of dayOfWeek/mealType
  // assignments now — if it leaves a slot unassigned (or assigns a
  // recipeTitle that doesn't match any recipe), assembleDays drops that
  // day rather than persisting it half-filled, and assertCompleteDays turns
  // the shortfall into a clear failure instead of a silently thin plan.
  it('throws MealPlanGenerationError when the skeleton leaves a day without a complete assignment', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
            // dayOfWeek 1 never assigned.
          ],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))

    await expect(generateMealPlan({ ...baseInput, daysCount: 2 })).rejects.toThrow(
      'Meal plan generation returned fewer days than requested',
    )
  })

  it('throws MealPlanGenerationError when the skeleton returns no assignments at all', async () => {
    mockCreate
      .mockResolvedValueOnce(skeleton([{ title: 'Lunch A' }, { title: 'Dinner A' }], []))
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))

    await expect(generateMealPlan({ ...baseInput, daysCount: 2 })).rejects.toThrow(
      'Meal plan generation returned fewer days than requested',
    )
  })

  // The whole point of writing each distinct dish's recipe ONCE (instead of
  // once per day, like the old per-day-chunk approach) is that the call
  // count no longer grows with how long the week is — only with the
  // (capped-at-5) number of distinct dishes.
  it('generates a full week in a fixed 3 calls (skeleton, recipes, batchPrepPlan), regardless of day count', async () => {
    const recipeStubs = [{ title: 'Dish A' }, { title: 'Dish B' }]
    const assignments = Array.from({ length: 7 }, (_, d) => [
      { dayOfWeek: d, mealType: 'lunch' as const, recipeTitle: 'Dish A' },
      { dayOfWeek: d, mealType: 'dinner' as const, recipeTitle: 'Dish B' },
    ]).flat()

    mockCreate
      .mockResolvedValueOnce(skeleton(recipeStubs, assignments))
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Dish A'), validMeal('Dish B')] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    const result = await generateMealPlan({ ...baseInput, daysCount: 7 })

    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result.days).toHaveLength(7)
    expect(result.days.every((d) => d.lunch.title === 'Dish A' && d.dinner.title === 'Dish B')).toBe(true)
  })

  it('asks for the full recipe of every distinct dish in one call, built from the shared base components', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [
            { title: 'Dish A', usesComponents: ['Cooked rice'] },
            { title: 'Dish B', usesComponents: ['Cooked rice'] },
          ],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Dish A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dish B' },
          ],
          [{ name: 'Cooked rice', ingredients: [{ name: 'rice', amount: 500, unit: 'g' }] }],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Dish A'), validMeal('Dish B')] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    await generateMealPlan({ ...baseInput, daysCount: 1 })

    const recipesCallSystem = mockCreate.mock.calls[1][0].messages[0].content as string
    expect(recipesCallSystem).toContain('Dish A')
    expect(recipesCallSystem).toContain('Dish B')
    expect(recipesCallSystem).toContain('Cooked rice')
  })

  it('throws MealPlanGenerationError when the recipes call returns fewer dishes than the skeleton committed to', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Dish A' }, { title: 'Dish B' }, { title: 'Dish C' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Dish A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dish B' },
          ],
        ),
      )
      // Only 2 of the 3 committed dishes come back.
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Dish A'), validMeal('Dish B')] }))

    await expect(generateMealPlan({ ...baseInput, daysCount: 1 })).rejects.toThrow(
      'Meal plan generation returned fewer days than requested',
    )
  })

  it('asks for batchPrepPlan in a separate call, seeded with the base components and the final dish list', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A', usesComponents: ['Cooked rice'] }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
            { dayOfWeek: 1, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 1, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
          [{ name: 'Cooked rice', ingredients: [{ name: 'rice', amount: 500, unit: 'g' }] }],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: { storageNotes: 'Keep refrigerated.' } }))

    const result = await generateMealPlan(baseInput)

    expect(mockCreate).toHaveBeenCalledTimes(3)
    const batchPrepCallSystem = mockCreate.mock.calls[2][0].messages[0].content as string
    expect(batchPrepCallSystem).toContain('Lunch A')
    expect(batchPrepCallSystem).toContain('rice')
    expect(batchPrepCallSystem).toContain('Cooked rice')
    // The realistic-timing floor this redesign adds against the model's
    // tendency to lowball a multi-dish batch-cooking session.
    expect(batchPrepCallSystem).toContain('60 minutes')
    expect(result.batchPrepPlan.storageNotes).toBe('Keep refrigerated.')
  })

  it('includes a breakfast meal per day only when requested', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Breakfast A' }, { title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'breakfast', recipeTitle: 'Breakfast A' },
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockResolvedValueOnce(
        completion({ recipes: [validMeal('Breakfast A'), validMeal('Lunch A'), validMeal('Dinner A')] }),
      )
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    const result = await generateMealPlan({ ...baseInput, includeBreakfast: true, daysCount: 1 })

    expect(result.days[0].breakfast?.title).toBe('Breakfast A')
  })

  // Regression test: the skeleton isn't strictly prevented from assigning a
  // breakfast slot even when includeBreakfast is false (the prompt only
  // omits asking for one) — assembleDays must drop it regardless of what
  // the model actually returned, instead of trusting its presence alone.
  it('drops a breakfast assignment the skeleton returned despite includeBreakfast being false', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Breakfast A' }, { title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'breakfast', recipeTitle: 'Breakfast A' },
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockResolvedValueOnce(
        completion({ recipes: [validMeal('Breakfast A'), validMeal('Lunch A'), validMeal('Dinner A')] }),
      )
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    const result = await generateMealPlan({ ...baseInput, includeBreakfast: false, daysCount: 1 })

    expect(result.days[0].breakfast).toBeUndefined()
  })

  // The model's own "title" field in the recipes response is never
  // trusted — it's always forced back to the skeleton's committed title
  // (same philosophy as dayOfWeek never being trusted from the model) so
  // the join with "assignments" can never silently miss.
  it('coerces a malformed meal (missing fields) instead of throwing, forcing the title from the skeleton', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [{}, { title: 'Dinner A' }] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: null }))

    const result = await generateMealPlan({ ...baseInput, daysCount: 1 })

    expect(result.days[0].lunch.title).toBe('Lunch A')
    expect(result.days[0].lunch.ingredients).toEqual([])
    expect(result.days[0].dinner.title).toBe('Dinner A')
    expect(result.batchPrepPlan).toEqual({
      menu: [],
      totalQuantities: [],
      sharedComponents: [],
      cookingOrder: [],
      storageNotes: '',
      // Realistic floor, not an optimistic guess — see
      // buildBatchPrepPlanSystemPrompt's own 60-90 minute guidance.
      estimatedTotalMinutes: 90,
    })
  })

  it('coerces sharedComponents, filling in defaults for missing fields', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Lunch A' },
          ],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A')] }))
      .mockResolvedValueOnce(
        completion({
          batchPrepPlan: {
            sharedComponents: [
              {
                name: 'Base dough',
                description: 'A simple dough used for empanadas and a pie.',
                ingredients: [{ name: 'flour', amount: 500, unit: 'g' }],
                steps: ['Mix the flour with water and salt.'],
                usedInDishes: ['Lunch A'],
              },
              {},
            ],
          },
        }),
      )

    const result = await generateMealPlan({ ...baseInput, daysCount: 1 })

    expect(result.batchPrepPlan.sharedComponents).toHaveLength(2)
    expect(result.batchPrepPlan.sharedComponents[0]).toEqual({
      name: 'Base dough',
      description: 'A simple dough used for empanadas and a pie.',
      ingredients: [{ name: 'flour', amount: 500, unit: 'g' }],
      steps: ['Mix the flour with water and salt.'],
      usedInDishes: ['Lunch A'],
    })
    expect(result.batchPrepPlan.sharedComponents[1]).toEqual({
      name: 'Base preparation',
      description: '',
      ingredients: [],
      steps: [],
      usedInDishes: [],
    })
  })

  it('passes the geo hint and ingredientsOnHand through to the skeleton prompt', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    await generateMealPlan({
      ...baseInput,
      daysCount: 1,
      ingredientsOnHand: ['chicken', 'rice'],
      geoHint: 'Approximate user location: latitude -34.6, longitude -58.4.',
    })

    const skeletonSystem = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(skeletonSystem).toContain('chicken, rice')
    expect(skeletonSystem).toContain('latitude -34.6')
  })

  // The redesign reinterprets timeAvailableMinutes as the whole batch
  // session's budget (what the UI's selector actually represents, per
  // MealPlanGenerator.tsx), not a per-individual-meal cap — so it should
  // size the skeleton's ambition and the batchPrepPlan's target, not
  // constrain each dish's own "totalTimeMinutes".
  it('uses timeAvailableMinutes as the batch-session budget, not a per-meal cap', async () => {
    mockCreate
      .mockResolvedValueOnce(
        skeleton(
          [{ title: 'Lunch A' }, { title: 'Dinner A' }],
          [
            { dayOfWeek: 0, mealType: 'lunch', recipeTitle: 'Lunch A' },
            { dayOfWeek: 0, mealType: 'dinner', recipeTitle: 'Dinner A' },
          ],
        ),
      )
      .mockResolvedValueOnce(completion({ recipes: [validMeal('Lunch A'), validMeal('Dinner A')] }))
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    await generateMealPlan({ ...baseInput, daysCount: 1, timeAvailableMinutes: 90 })

    const skeletonSystem = mockCreate.mock.calls[0][0].messages[0].content as string
    const recipesSystem = mockCreate.mock.calls[1][0].messages[0].content as string
    const batchPrepSystem = mockCreate.mock.calls[2][0].messages[0].content as string

    expect(skeletonSystem).toContain('90 minutes')
    expect(batchPrepSystem).toContain('90 minutes')
    expect(recipesSystem).not.toContain('minutes available to cook')
  })

  // Regression test for the core complaint this redesign fixes: the
  // skeleton must ask for a SMALL, fixed number of dishes (never one per
  // meal slot) so the week's dishes actually repeat as real meal-prep
  // leftovers instead of being a different recipe every time.
  it('asks the skeleton for a small, scaled number of distinct recipes rather than one per meal slot', async () => {
    mockCreate.mockResolvedValueOnce(completion({ baseComponents: [], recipes: [], assignments: [] }))

    // 7 days × 2 meals = 14 slots → ceil(14 / 3) = 5 distinct dishes.
    await generateMealPlan({ ...baseInput, daysCount: 7, includeBreakfast: false }).catch(() => {})

    const skeletonSystem = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(skeletonSystem).toContain('EXACTLY 5 distinct dish recipes')
  })
})

describe('refineMealPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
  })

  it('sends the current plan and the refinement message, and returns the updated plan', async () => {
    const currentPlan: GeneratedMealPlan = {
      days: [{ dayOfWeek: 0, lunch: validMeal('Old lunch'), dinner: validMeal('Old dinner') }],
      batchPrepPlan: {
        menu: [],
        totalQuantities: [],
        sharedComponents: [],
        cookingOrder: [],
        storageNotes: '',
        estimatedTotalMinutes: 90,
      },
    }
    mockCreate.mockResolvedValue(
      completion({
        days: [{ dayOfWeek: 0, lunch: validMeal('New lunch'), dinner: validMeal('New dinner') }],
        batchPrepPlan: {
          menu: [],
          totalQuantities: [],
          sharedComponents: [],
          cookingOrder: [],
          storageNotes: '',
          estimatedTotalMinutes: 90,
        },
      }),
    )

    const result = await refineMealPlan(currentPlan, 'make it spicier', { ...baseInput, daysCount: 1 })

    expect(result.days[0].lunch.title).toBe('New lunch')
    const [{ messages }] = mockCreate.mock.calls[0]
    expect(messages[0].content).toContain('Old lunch')
    expect(messages[1]).toEqual({ role: 'user', content: 'make it spicier' })
  })

  // A refinement must NOT re-run the skeleton (that would reinvent the
  // week's shared base components over a targeted tweak) — instead it
  // carries forward the current plan's own sharedComponents as fixed
  // context for each days-chunk refinement call.
  it("carries the current plan's shared components forward instead of re-deciding them", async () => {
    const currentPlan: GeneratedMealPlan = {
      days: [{ dayOfWeek: 0, lunch: validMeal('Old lunch'), dinner: validMeal('Old dinner') }],
      batchPrepPlan: {
        menu: [],
        totalQuantities: [],
        sharedComponents: [
          {
            name: 'Cooked rice',
            description: '',
            ingredients: [{ name: 'rice', amount: 500, unit: 'g' }],
            steps: [],
            usedInDishes: ['Old lunch'],
          },
        ],
        cookingOrder: [],
        storageNotes: '',
        estimatedTotalMinutes: 90,
      },
    }
    mockCreate.mockResolvedValue(
      completion({
        days: [{ dayOfWeek: 0, lunch: validMeal('New lunch'), dinner: validMeal('New dinner') }],
        batchPrepPlan: {},
      }),
    )

    await refineMealPlan(currentPlan, 'less spicy', { ...baseInput, daysCount: 1 })

    // Only 2 calls total (days-chunk + batchPrepPlan) — no skeleton call.
    expect(mockCreate).toHaveBeenCalledTimes(2)
    const daysChunkSystem = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(daysChunkSystem).toContain('Cooked rice')
  })

  it('throws MealPlanGenerationError when the refined plan comes back with fewer days than requested', async () => {
    const currentPlan: GeneratedMealPlan = {
      days: [
        { dayOfWeek: 0, lunch: validMeal('Old lunch A'), dinner: validMeal('Old dinner A') },
        { dayOfWeek: 1, lunch: validMeal('Old lunch B'), dinner: validMeal('Old dinner B') },
      ],
      batchPrepPlan: {
        menu: [],
        totalQuantities: [],
        sharedComponents: [],
        cookingOrder: [],
        storageNotes: '',
        estimatedTotalMinutes: 90,
      },
    }
    mockCreate.mockResolvedValue(
      completion({
        days: [{ dayOfWeek: 0, lunch: validMeal('New lunch'), dinner: validMeal('New dinner') }],
        batchPrepPlan: {},
      }),
    )

    await expect(
      refineMealPlan(currentPlan, 'make it spicier', { ...baseInput, daysCount: 2 }),
    ).rejects.toThrow('Meal plan generation returned fewer days than requested')
  })

  it('splits refinement across chunks too, passing only each chunk its own slice of the current plan', async () => {
    const currentPlan: GeneratedMealPlan = {
      days: [
        { dayOfWeek: 0, lunch: validMeal('Old A'), dinner: validMeal('Old A2') },
        { dayOfWeek: 1, lunch: validMeal('Old B'), dinner: validMeal('Old B2') },
        { dayOfWeek: 2, lunch: validMeal('Old C'), dinner: validMeal('Old C2') },
        { dayOfWeek: 3, lunch: validMeal('Old D'), dinner: validMeal('Old D2') },
      ],
      batchPrepPlan: {
        menu: [],
        totalQuantities: [],
        sharedComponents: [],
        cookingOrder: [],
        storageNotes: '',
        estimatedTotalMinutes: 90,
      },
    }
    mockCreate
      .mockResolvedValueOnce(
        completion({
          days: [
            { dayOfWeek: 0, lunch: validMeal('New A'), dinner: validMeal('New A2') },
            { dayOfWeek: 1, lunch: validMeal('New B'), dinner: validMeal('New B2') },
          ],
        }),
      )
      .mockResolvedValueOnce(
        completion({
          days: [
            { dayOfWeek: 0, lunch: validMeal('New C'), dinner: validMeal('New C2') },
            { dayOfWeek: 1, lunch: validMeal('New D'), dinner: validMeal('New D2') },
          ],
        }),
      )
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    const result = await refineMealPlan(currentPlan, 'make it spicier', { ...baseInput, daysCount: 4 })

    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result.days).toHaveLength(4)
    expect(result.days.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3])

    const secondChunkSystem = mockCreate.mock.calls[1][0].messages[0].content as string
    expect(secondChunkSystem).toContain('Old C')
    expect(secondChunkSystem).toContain('Old D')
    expect(secondChunkSystem).not.toContain('Old A')
  })

  // Regression test: a days-chunk call occasionally returns MORE day
  // objects than that chunk actually asked for (e.g. the model repeats a
  // dish as an extra entry). Trusting the raw array length to derive
  // dayOfWeek (dayOfWeekStart + array position) pushed that extra day's
  // number past this chunk's own range and straight into the NEXT chunk's
  // range, so two days from different chunks ended up with the same
  // dayOfWeek — violating MealPlanEntry's (mealPlanId, dayOfWeek, mealType)
  // unique DB constraint and 500ing the whole /meal-plan request.
  it("ignores extra day objects beyond this chunk's own size, instead of letting them collide with the next chunk", async () => {
    const currentPlan: GeneratedMealPlan = {
      days: [
        { dayOfWeek: 0, lunch: validMeal('Old A'), dinner: validMeal('Old A2') },
        { dayOfWeek: 1, lunch: validMeal('Old B'), dinner: validMeal('Old B2') },
        { dayOfWeek: 2, lunch: validMeal('Old C'), dinner: validMeal('Old C2') },
        { dayOfWeek: 3, lunch: validMeal('Old D'), dinner: validMeal('Old D2') },
      ],
      batchPrepPlan: {
        menu: [],
        totalQuantities: [],
        sharedComponents: [],
        cookingOrder: [],
        storageNotes: '',
        estimatedTotalMinutes: 90,
      },
    }
    mockCreate
      .mockResolvedValueOnce(
        completion({
          days: [
            { dayOfWeek: 0, lunch: validMeal('New A'), dinner: validMeal('New A2') },
            { dayOfWeek: 1, lunch: validMeal('New B'), dinner: validMeal('New B2') },
            // Extra, unrequested 3rd day for a chunk that only covers 2.
            { dayOfWeek: 1, lunch: validMeal('New Extra'), dinner: validMeal('New Extra2') },
          ],
        }),
      )
      .mockResolvedValueOnce(
        completion({
          days: [
            { dayOfWeek: 0, lunch: validMeal('New C'), dinner: validMeal('New C2') },
            { dayOfWeek: 1, lunch: validMeal('New D'), dinner: validMeal('New D2') },
          ],
        }),
      )
      .mockResolvedValueOnce(completion({ batchPrepPlan: {} }))

    const result = await refineMealPlan(currentPlan, 'make it spicier', { ...baseInput, daysCount: 4 })

    expect(result.days).toHaveLength(4)
    expect(result.days.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3])
    expect(new Set(result.days.map((d) => d.dayOfWeek)).size).toBe(4)
  })
})

describe('swapMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
  })

  it('returns the replacement meal and mentions the excluded title and reason in the prompt', async () => {
    mockCreate.mockResolvedValue(completion({ meal: validMeal('New lunch') }))

    const result = await swapMeal({
      ...baseInput,
      dayOfWeek: 0,
      mealType: 'lunch',
      excludeTitle: 'Old lunch',
      otherTitlesInPlan: ['Old dinner'],
      reason: 'no me gusta el pescado',
    })

    expect(result.title).toBe('New lunch')
    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('Old lunch')
    expect(system).toContain('Old dinner')
    expect(system).toContain('no me gusta el pescado')
  })

  it('sets a low reasoning effort for the single-meal call too', async () => {
    mockCreate.mockResolvedValue(completion({ meal: validMeal('New lunch') }))

    await swapMeal({
      ...baseInput,
      dayOfWeek: 0,
      mealType: 'lunch',
      excludeTitle: 'Old lunch',
      otherTitlesInPlan: [],
    })

    const call = mockCreate.mock.calls[0][0]
    expect(call.reasoning_effort).toBe('low')
    expect(call.max_tokens).toBeGreaterThan(0)
  })

  it('coerces a malformed response instead of throwing', async () => {
    mockCreate.mockResolvedValue(completion({ meal: {} }))

    const result = await swapMeal({
      ...baseInput,
      dayOfWeek: 0,
      mealType: 'dinner',
      excludeTitle: 'Old dinner',
      otherTitlesInPlan: [],
    })

    expect(result.title).toBe('Untitled dish')
  })
})

describe('resolveMealImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
  })

  it('returns the Spoonacular image when a match is found', async () => {
    mockSearchRecipeByTitle.mockResolvedValue({ image: 'spoon.jpg' })
    expect(await resolveMealImage('Lunch A', 'en')).toBe('spoon.jpg')
    expect(mockSearchEdamamRecipes).not.toHaveBeenCalled()
  })

  it('falls back to Edamam when Spoonacular has no match', async () => {
    mockSearchRecipeByTitle.mockResolvedValue(null)
    mockSearchEdamamRecipes.mockResolvedValue([{ image: 'edamam.jpg' }])
    expect(await resolveMealImage('Lunch A', 'en')).toBe('edamam.jpg')
  })

  it('returns an empty string instead of throwing when both providers fail', async () => {
    mockSearchRecipeByTitle.mockRejectedValue(new Error('quota'))
    mockSearchEdamamRecipes.mockRejectedValue(new Error('quota'))
    expect(await resolveMealImage('Lunch A', 'en')).toBe('')
  })

  it('does not translate when the plan language is already English', async () => {
    mockSearchRecipeByTitle.mockResolvedValue({ image: 'spoon.jpg' })
    await resolveMealImage('Lunch A', 'en')
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockSearchRecipeByTitle).toHaveBeenCalledWith('Lunch A')
  })

  // Regression test for the root cause of "recipes never get a photo":
  // Spoonacular/Edamam only index English text, but dish titles are
  // generated in the plan's own language — searching with the untranslated
  // title almost never matched anything.
  it('translates a non-English title before searching', async () => {
    mockCreate.mockResolvedValue(completion({ title: 'Chicken and rice' }))
    mockSearchRecipeByTitle.mockResolvedValue({ image: 'spoon.jpg' })

    const result = await resolveMealImage('Arroz con pollo', 'es')

    expect(result).toBe('spoon.jpg')
    expect(mockSearchRecipeByTitle).toHaveBeenCalledWith('Chicken and rice')
  })

  it('falls back to the original title if translation fails', async () => {
    mockCreate.mockRejectedValue(new Error('translation failed'))
    mockSearchRecipeByTitle.mockResolvedValue({ image: 'spoon.jpg' })

    const result = await resolveMealImage('Arroz con pollo', 'es')

    expect(result).toBe('spoon.jpg')
    expect(mockSearchRecipeByTitle).toHaveBeenCalledWith('Arroz con pollo')
  })
})
