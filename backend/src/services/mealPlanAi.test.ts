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

  it('returns the parsed days and batchPrepPlan from a well-formed response', async () => {
    mockCreate.mockResolvedValue(
      completion({
        days: [
          { dayOfWeek: 0, lunch: validMeal('Lunch A'), dinner: validMeal('Dinner A') },
          { dayOfWeek: 1, lunch: validMeal('Lunch B'), dinner: validMeal('Dinner B') },
        ],
        batchPrepPlan: {
          menu: ['Lunch A', 'Dinner A'],
          totalQuantities: [{ name: 'rice', amount: 400, unit: 'g' }],
          cookingOrder: ['Preheat the oven to 200°C.'],
          storageNotes: 'Store in airtight containers.',
          estimatedTotalMinutes: 60,
        },
      }),
    )

    const result = await generateMealPlan(baseInput)

    expect(result.days).toHaveLength(2)
    expect(result.days[0].lunch.title).toBe('Lunch A')
    expect(result.days[0].breakfast).toBeUndefined()
    expect(result.batchPrepPlan.storageNotes).toBe('Store in airtight containers.')
  })

  it('includes a breakfast meal per day only when requested', async () => {
    mockCreate.mockResolvedValue(
      completion({
        days: [
          {
            dayOfWeek: 0,
            breakfast: validMeal('Breakfast A'),
            lunch: validMeal('Lunch A'),
            dinner: validMeal('Dinner A'),
          },
        ],
        batchPrepPlan: {},
      }),
    )

    const result = await generateMealPlan({ ...baseInput, includeBreakfast: true, daysCount: 1 })

    expect(result.days[0].breakfast?.title).toBe('Breakfast A')
  })

  it('coerces a malformed meal (missing fields) instead of throwing', async () => {
    mockCreate.mockResolvedValue(
      completion({
        days: [{ dayOfWeek: 0, lunch: {}, dinner: { title: 'Dinner A' } }],
        batchPrepPlan: null,
      }),
    )

    const result = await generateMealPlan({ ...baseInput, daysCount: 1 })

    expect(result.days[0].lunch.title).toBe('Untitled dish')
    expect(result.days[0].lunch.ingredients).toEqual([])
    expect(result.days[0].dinner.title).toBe('Dinner A')
    expect(result.batchPrepPlan).toEqual({
      menu: [],
      totalQuantities: [],
      sharedComponents: [],
      cookingOrder: [],
      storageNotes: '',
      estimatedTotalMinutes: 60,
    })
  })

  it('coerces sharedComponents, filling in defaults for missing fields', async () => {
    mockCreate.mockResolvedValue(
      completion({
        days: [{ dayOfWeek: 0, lunch: validMeal('Lunch A'), dinner: validMeal('Dinner A') }],
        batchPrepPlan: {
          sharedComponents: [
            {
              name: 'Base dough',
              description: 'A simple dough used for empanadas and a pie.',
              ingredients: [{ name: 'flour', amount: 500, unit: 'g' }],
              steps: ['Mix the flour with water and salt.'],
              usedInDishes: ['Lunch A', 'Dinner A'],
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
      usedInDishes: ['Lunch A', 'Dinner A'],
    })
    expect(result.batchPrepPlan.sharedComponents[1]).toEqual({
      name: 'Base preparation',
      description: '',
      ingredients: [],
      steps: [],
      usedInDishes: [],
    })
  })

  it('passes the geo hint and ingredientsOnHand through to the prompt', async () => {
    mockCreate.mockResolvedValue(completion({ days: [], batchPrepPlan: {} }))

    await generateMealPlan({
      ...baseInput,
      ingredientsOnHand: ['chicken', 'rice'],
      geoHint: 'Approximate user location: latitude -34.6, longitude -58.4.',
    })

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('chicken, rice')
    expect(system).toContain('latitude -34.6')
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
        estimatedTotalMinutes: 30,
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
          estimatedTotalMinutes: 30,
        },
      }),
    )

    const result = await refineMealPlan(currentPlan, 'make it spicier', { ...baseInput, daysCount: 1 })

    expect(result.days[0].lunch.title).toBe('New lunch')
    const [{ messages }] = mockCreate.mock.calls[0]
    expect(messages[0].content).toContain('Old lunch')
    expect(messages[1]).toEqual({ role: 'user', content: 'make it spicier' })
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
  })

  it('returns the Spoonacular image when a match is found', async () => {
    mockSearchRecipeByTitle.mockResolvedValue({ image: 'spoon.jpg' })
    expect(await resolveMealImage('Lunch A')).toBe('spoon.jpg')
    expect(mockSearchEdamamRecipes).not.toHaveBeenCalled()
  })

  it('falls back to Edamam when Spoonacular has no match', async () => {
    mockSearchRecipeByTitle.mockResolvedValue(null)
    mockSearchEdamamRecipes.mockResolvedValue([{ image: 'edamam.jpg' }])
    expect(await resolveMealImage('Lunch A')).toBe('edamam.jpg')
  })

  it('returns an empty string instead of throwing when both providers fail', async () => {
    mockSearchRecipeByTitle.mockRejectedValue(new Error('quota'))
    mockSearchEdamamRecipes.mockRejectedValue(new Error('quota'))
    expect(await resolveMealImage('Lunch A')).toBe('')
  })
})
