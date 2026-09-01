import { describe, it, expect } from 'vitest'
import { instructionSteps } from './recipeSerializers'
import type { SpoonacularRecipe } from './spoonacular'

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
