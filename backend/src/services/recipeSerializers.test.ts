import { describe, it, expect, vi } from 'vitest'
import { instructionSteps, serializeDetail, nutrientPercent } from './recipeSerializers'
import type { SpoonacularRecipe } from './spoonacular'

vi.mock('./groq.js', () => ({
  translateRecipeContent: vi.fn(),
}))

function recipe(overrides: Partial<SpoonacularRecipe>): SpoonacularRecipe {
  return {
    id: 1,
    title: 'Test recipe',
    image: 'img.jpg',
    servings: 2,
    readyInMinutes: 20,
    ...overrides,
  }
}

describe('instructionSteps', () => {
  it('reads steps from a single analyzedInstructions group', () => {
    const r = recipe({
      analyzedInstructions: [{ steps: [{ number: 1, step: 'Boil water.' }, { number: 2, step: 'Add pasta.' }] }],
    })
    expect(instructionSteps(r)).toEqual(['Boil water.', 'Add pasta.'])
  })

  it('flattens steps across multiple analyzedInstructions groups', () => {
    const r = recipe({
      analyzedInstructions: [
        { steps: [{ number: 1, step: 'Mix the marinade.' }] },
        { steps: [{ number: 1, step: 'Grill the chicken.' }] },
      ],
    })
    expect(instructionSteps(r)).toEqual(['Mix the marinade.', 'Grill the chicken.'])
  })

  it('falls through to a later non-empty group when the first group is empty', () => {
    const r = recipe({
      analyzedInstructions: [
        { steps: [] },
        { steps: [{ number: 1, step: 'Preheat the oven.' }] },
      ],
    })
    expect(instructionSteps(r)).toEqual(['Preheat the oven.'])
  })

  it('strips HTML tags from the raw instructions field when analyzedInstructions is empty', () => {
    const r = recipe({
      analyzedInstructions: [],
      instructions: '<ol><li>Boil water.</li><li>Add pasta.</li></ol>',
    })
    expect(instructionSteps(r)).toEqual(['Boil water. Add pasta.'])
  })

  it('falls back to the raw instructions field when analyzedInstructions is missing entirely', () => {
    const r = recipe({ instructions: 'Just mix everything together.' })
    expect(instructionSteps(r)).toEqual(['Just mix everything together.'])
  })

  it('returns an empty array when there are no instructions anywhere', () => {
    const r = recipe({ analyzedInstructions: [], instructions: '' })
    expect(instructionSteps(r)).toEqual([])
  })

  it('returns an empty array when both fields are entirely absent', () => {
    const r = recipe({})
    expect(instructionSteps(r)).toEqual([])
  })
})

describe('nutrientPercent', () => {
  it('reads percentOfDailyNeeds, rounded', () => {
    const r = recipe({ nutrition: { nutrients: [{ name: 'Calories', amount: 400, unit: 'kcal', percentOfDailyNeeds: 19.6 }] } })
    expect(nutrientPercent(r, 'Calories')).toBe(20)
  })

  it('returns 0 when the nutrient is missing', () => {
    const r = recipe({ nutrition: { nutrients: [] } })
    expect(nutrientPercent(r, 'Calories')).toBe(0)
  })

  it('returns 0 when percentOfDailyNeeds is absent on the matched nutrient', () => {
    const r = recipe({ nutrition: { nutrients: [{ name: 'Calories', amount: 400, unit: 'kcal' }] } })
    expect(nutrientPercent(r, 'Calories')).toBe(0)
  })

  it('returns 0 when there is no nutrition data at all', () => {
    const r = recipe({})
    expect(nutrientPercent(r, 'Calories')).toBe(0)
  })
})

describe('serializeDetail — nutrition percentages', () => {
  it('includes the four *Percent fields in the serialized nutrition object', async () => {
    const r = recipe({
      nutrition: {
        nutrients: [
          { name: 'Calories', amount: 400, unit: 'kcal', percentOfDailyNeeds: 20 },
          { name: 'Protein', amount: 15, unit: 'g', percentOfDailyNeeds: 30 },
          { name: 'Carbohydrates', amount: 50, unit: 'g', percentOfDailyNeeds: 17 },
          { name: 'Fat', amount: 10, unit: 'g', percentOfDailyNeeds: 15 },
        ],
      },
    })
    const detail = await serializeDetail(r, 'en')
    expect(detail.nutrition).toMatchObject({
      caloriesPercent: 20,
      proteinPercent: 30,
      carbsPercent: 17,
      fatPercent: 15,
    })
  })
})

describe('serializeDetail — measures (metric/imperial)', () => {
  it('carries both metric and us measures per ingredient, defaulting amount/unit to metric', async () => {
    const r = recipe({
      extendedIngredients: [
        {
          id: 1,
          name: 'flour',
          amount: 2,
          unit: 'cups',
          original: '2 cups flour',
          measures: {
            us: { amount: 2, unitShort: 'cups', unitLong: 'cups' },
            metric: { amount: 240, unitShort: 'g', unitLong: 'grams' },
          },
        },
      ],
    })
    const detail = await serializeDetail(r, 'en')
    expect(detail.ingredients[0].measures).toEqual({
      metric: { amount: 240, unit: 'g' },
      us: { amount: 2, unit: 'cups' },
    })
    expect(detail.ingredients[0].amount).toBe(240)
    expect(detail.ingredients[0].unit).toBe('g')
  })

  it('falls back to the flat amount/unit for both systems when measures is missing', async () => {
    const r = recipe({
      extendedIngredients: [
        { id: 1, name: 'salt', amount: 1, unit: 'tsp', original: '1 tsp salt' },
      ],
    })
    const detail = await serializeDetail(r, 'en')
    expect(detail.ingredients[0].measures).toEqual({
      metric: { amount: 1, unit: 'tsp' },
      us: { amount: 1, unit: 'tsp' },
    })
  })
})
