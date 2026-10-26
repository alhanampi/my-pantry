import { describe, it, expect, vi } from 'vitest'
import {
  normalizeSpoonacularRecipe,
  normalizeEdamamRecipe,
  serializeCard,
  serializeDetail,
  makeRecipeId,
  parseRecipeId,
  searchWithEdamamSupplement,
} from './recipeSerializers'
import type { SpoonacularRecipe } from './spoonacular'
import type { EdamamRecipe } from './edamam'
import { translateRecipeContent } from './groq'
import { searchEdamamRecipes } from './edamam'

vi.mock('./groq.js', () => ({
  translateRecipeContent: vi.fn(),
}))

vi.mock('./edamam.js', () => ({
  searchEdamamRecipes: vi.fn(),
}))

function spoonacularRecipe(overrides: Partial<SpoonacularRecipe>): SpoonacularRecipe {
  return {
    id: 1,
    title: 'Test recipe',
    image: 'img.jpg',
    servings: 2,
    readyInMinutes: 20,
    ...overrides,
  }
}

function edamamRecipe(overrides: Partial<EdamamRecipe> = {}): EdamamRecipe {
  return {
    uri: 'http://www.edamam.com/ontologies/edamam.owl#recipe_abc123',
    label: 'Milanesa',
    image: 'img.jpg',
    source: 'Some Blog',
    url: 'https://example.com/milanesa',
    yield: 2,
    totalTime: 30,
    ingredientLines: ['200g carne'],
    ingredients: [{ text: '200g carne', quantity: 200, measure: 'gram', food: 'beef', weight: 200 }],
    totalNutrients: {
      ENERC_KCAL: { label: 'Energy', quantity: 800, unit: 'kcal' },
      PROCNT: { label: 'Protein', quantity: 60, unit: 'g' },
      CHOCDF: { label: 'Carbs', quantity: 40, unit: 'g' },
      FAT: { label: 'Fat', quantity: 30, unit: 'g' },
    },
    totalDaily: {
      ENERC_KCAL: { label: 'Energy', quantity: 40, unit: '%' },
      PROCNT: { label: 'Protein', quantity: 60, unit: '%' },
      CHOCDF: { label: 'Carbs', quantity: 14, unit: '%' },
      FAT: { label: 'Fat', quantity: 30, unit: '%' },
    },
    ...overrides,
  }
}

describe('makeRecipeId / parseRecipeId', () => {
  it('round-trips a spoonacular numeric id', () => {
    const id = makeRecipeId('spoonacular', 715538)
    expect(id).toBe('spoonacular:715538')
    expect(parseRecipeId(id)).toEqual({ source: 'spoonacular', externalId: '715538' })
  })

  it('round-trips an edamam uri, even with colons/hashes inside it', () => {
    const uri = 'http://www.edamam.com/ontologies/edamam.owl#recipe_abc123'
    const id = makeRecipeId('edamam', uri)
    expect(parseRecipeId(id)).toEqual({ source: 'edamam', externalId: uri })
  })

  it('returns null for an unrecognized source prefix', () => {
    expect(parseRecipeId('cookpad:123')).toBeNull()
  })

  it('returns null for a string with no separator at all', () => {
    expect(parseRecipeId('715538')).toBeNull()
  })
})

describe('normalizeSpoonacularRecipe — instructions', () => {
  it('reads steps from a single analyzedInstructions group', () => {
    const r = spoonacularRecipe({
      analyzedInstructions: [{ steps: [{ number: 1, step: 'Boil water.' }, { number: 2, step: 'Add pasta.' }] }],
    })
    expect(normalizeSpoonacularRecipe(r).instructions).toEqual(['Boil water.', 'Add pasta.'])
  })

  it('flattens steps across multiple analyzedInstructions groups', () => {
    const r = spoonacularRecipe({
      analyzedInstructions: [
        { steps: [{ number: 1, step: 'Mix the marinade.' }] },
        { steps: [{ number: 1, step: 'Grill the chicken.' }] },
      ],
    })
    expect(normalizeSpoonacularRecipe(r).instructions).toEqual(['Mix the marinade.', 'Grill the chicken.'])
  })

  it('falls through to a later non-empty group when the first group is empty', () => {
    const r = spoonacularRecipe({
      analyzedInstructions: [
        { steps: [] },
        { steps: [{ number: 1, step: 'Preheat the oven.' }] },
      ],
    })
    expect(normalizeSpoonacularRecipe(r).instructions).toEqual(['Preheat the oven.'])
  })

  it('strips HTML tags from the raw instructions field when analyzedInstructions is empty', () => {
    const r = spoonacularRecipe({
      analyzedInstructions: [],
      instructions: '<ol><li>Boil water.</li><li>Add pasta.</li></ol>',
    })
    expect(normalizeSpoonacularRecipe(r).instructions).toEqual(['Boil water. Add pasta.'])
  })

  it('falls back to the raw instructions field when analyzedInstructions is missing entirely', () => {
    const r = spoonacularRecipe({ instructions: 'Just mix everything together.' })
    expect(normalizeSpoonacularRecipe(r).instructions).toEqual(['Just mix everything together.'])
  })

  it('returns an empty array when there are no instructions anywhere', () => {
    const r = spoonacularRecipe({ analyzedInstructions: [], instructions: '' })
    expect(normalizeSpoonacularRecipe(r).instructions).toEqual([])
  })
})

describe('normalizeSpoonacularRecipe — nutrition percentages', () => {
  it('reads percentOfDailyNeeds, rounded', () => {
    const r = spoonacularRecipe({
      nutrition: { nutrients: [{ name: 'Calories', amount: 400, unit: 'kcal', percentOfDailyNeeds: 19.6 }] },
    })
    expect(normalizeSpoonacularRecipe(r).nutrition.caloriesPercent).toBe(20)
  })

  it('returns 0 when the nutrient is missing', () => {
    const r = spoonacularRecipe({ nutrition: { nutrients: [] } })
    expect(normalizeSpoonacularRecipe(r).nutrition.caloriesPercent).toBe(0)
  })

  it('returns 0 when there is no nutrition data at all', () => {
    const r = spoonacularRecipe({})
    expect(normalizeSpoonacularRecipe(r).nutrition.caloriesPercent).toBe(0)
  })
})

describe('serializeDetail — measures (metric/imperial)', () => {
  it('carries both metric and us measures per ingredient, defaulting amount/unit to metric', async () => {
    const r = spoonacularRecipe({
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
    const detail = await serializeDetail(normalizeSpoonacularRecipe(r), 'en')
    expect(detail.ingredients[0].measures).toEqual({
      metric: { amount: 240, unit: 'g' },
      us: { amount: 2, unit: 'cups' },
    })
    expect(detail.ingredients[0].amount).toBe(240)
    expect(detail.ingredients[0].unit).toBe('g')
  })

  it('falls back to the flat amount/unit for both systems when measures is missing', async () => {
    const r = spoonacularRecipe({
      extendedIngredients: [{ id: 1, name: 'salt', amount: 1, unit: 'tsp', original: '1 tsp salt' }],
    })
    const detail = await serializeDetail(normalizeSpoonacularRecipe(r), 'en')
    expect(detail.ingredients[0].measures).toEqual({
      metric: { amount: 1, unit: 'tsp' },
      us: { amount: 1, unit: 'tsp' },
    })
  })
})

describe('serializeCard / serializeDetail — id and source', () => {
  it('tags a Spoonacular recipe with the compound id and source', async () => {
    const card = await serializeCard(normalizeSpoonacularRecipe(spoonacularRecipe({ id: 42 })), 'en')
    expect(card.id).toBe('spoonacular:42')
    expect(card.source).toBe('spoonacular')
  })

  it('tags an Edamam recipe with the compound id and source', async () => {
    const card = await serializeCard(normalizeEdamamRecipe(edamamRecipe()), 'en')
    expect(card.id).toBe(makeRecipeId('edamam', 'http://www.edamam.com/ontologies/edamam.owl#recipe_abc123'))
    expect(card.source).toBe('edamam')
  })
})

describe('serializeCard — ingredient name translation', () => {
  it('leaves ingredientNames untranslated when lang is not es', async () => {
    const r = spoonacularRecipe({
      extendedIngredients: [{ id: 1, name: 'chicken breast', amount: 1, unit: '', original: '1 chicken breast' }],
    })
    const card = await serializeCard(normalizeSpoonacularRecipe(r), 'en')
    expect(card.ingredientNames).toEqual(['chicken breast'])
    expect(translateRecipeContent).not.toHaveBeenCalled()
  })

  it('uses the translated ingredientNames (not the raw English ones) when lang is es', async () => {
    vi.mocked(translateRecipeContent).mockResolvedValueOnce({
      title: 'Pechuga de pollo',
      ingredientNames: ['pechuga de pollo'],
      instructionSteps: [],
    })
    const r = spoonacularRecipe({
      extendedIngredients: [{ id: 1, name: 'chicken breast', amount: 1, unit: '', original: '1 chicken breast' }],
    })
    const card = await serializeCard(normalizeSpoonacularRecipe(r), 'es')
    expect(card.title).toBe('Pechuga de pollo')
    expect(card.ingredientNames).toEqual(['pechuga de pollo'])
  })
})

describe('normalizeEdamamRecipe', () => {
  it('divides recipe-total nutrition by yield to get a per-serving estimate', () => {
    const normalized = normalizeEdamamRecipe(edamamRecipe({ yield: 4 }))
    expect(normalized.nutrition).toMatchObject({
      calories: 200, // 800 / 4
      protein: 15, // 60 / 4
      carbs: 10, // 40 / 4
      fat: 8, // 30 / 4 rounded
    })
  })

  it('maps ingredient text/quantity/measure onto NormalizedIngredient, using the same value for both measurement systems', () => {
    const normalized = normalizeEdamamRecipe(edamamRecipe())
    expect(normalized.ingredients[0]).toMatchObject({
      name: 'beef',
      amount: 200,
      unit: 'gram',
      original: '200g carne',
      measures: { metric: { amount: 200, unit: 'gram' }, us: { amount: 200, unit: 'gram' } },
    })
  })

  it('uses the recipe url as the only instruction, since Edamam gives no step-by-step instructions', () => {
    const normalized = normalizeEdamamRecipe(edamamRecipe({ url: 'https://example.com/recipe' }))
    expect(normalized.instructions).toEqual(['https://example.com/recipe'])
  })

  it('defaults servings to 1 when yield is 0/missing, to avoid dividing by zero', () => {
    const normalized = normalizeEdamamRecipe(edamamRecipe({ yield: 0 }))
    expect(normalized.servings).toBe(1)
    expect(normalized.nutrition.calories).toBe(800)
  })
})

describe('searchWithEdamamSupplement — cuisine forwarding', () => {
  const thinSpoonacularResult = { results: [], offset: 0, number: 3, totalResults: 0 }

  it('translates a mappable Spoonacular cuisine into Edamam cuisineType', async () => {
    vi.mocked(searchEdamamRecipes).mockResolvedValue([])

    await searchWithEdamamSupplement(thinSpoonacularResult, { cuisine: 'Middle Eastern' }, 3)

    expect(searchEdamamRecipes).toHaveBeenCalledWith(
      expect.objectContaining({ cuisineType: 'middle eastern' }),
    )
  })

  it('omits cuisineType when the cuisine has no Edamam equivalent', async () => {
    vi.mocked(searchEdamamRecipes).mockResolvedValue([])

    await searchWithEdamamSupplement(thinSpoonacularResult, { cuisine: 'Cajun' }, 3)

    expect(searchEdamamRecipes).toHaveBeenCalledWith(expect.objectContaining({ cuisineType: undefined }))
  })

  it('omits cuisineType when no cuisine was given at all', async () => {
    vi.mocked(searchEdamamRecipes).mockResolvedValue([])

    await searchWithEdamamSupplement(thinSpoonacularResult, { query: 'soup' }, 3)

    expect(searchEdamamRecipes).toHaveBeenCalledWith(expect.objectContaining({ cuisineType: undefined }))
  })
})
