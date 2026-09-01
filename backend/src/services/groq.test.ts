import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateRecipeContent } from './groq'

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

function completion(content: unknown) {
  return { choices: [{ message: { content: JSON.stringify(content) } }] }
}

describe('translateRecipeContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the original content unchanged for English', async () => {
    const recipe = { id: 1, title: 'Pasta', ingredientNames: ['flour'], instructionSteps: ['Boil water.'] }
    const result = await translateRecipeContent(recipe, 'en')
    expect(result).toEqual({ title: 'Pasta', ingredientNames: ['flour'], instructionSteps: ['Boil water.'] })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('translates via Groq and caches the result for the same recipe id/language', async () => {
    const recipe = { id: 2, title: 'Pasta', ingredientNames: ['flour'], instructionSteps: ['Boil water.'] }
    mockCreate.mockResolvedValue(
      completion({ title: 'Pasta ES', ingredientNames: ['harina'], instructionSteps: ['Hervir agua.'] }),
    )

    const first = await translateRecipeContent(recipe, 'es')
    expect(first.instructionSteps).toEqual(['Hervir agua.'])
    expect(mockCreate).toHaveBeenCalledTimes(1)

    const second = await translateRecipeContent(recipe, 'es')
    expect(second).toEqual(first)
    expect(mockCreate).toHaveBeenCalledTimes(1) // cache hit — no second Groq call
  })

  // Regression test for the actual bug reported: a recipe's Spanish
  // instructions stayed empty indefinitely even after the underlying
  // instructionSteps() extraction was fixed, because a translation cached
  // earlier (when the input used to be empty/shorter) was trusted forever
  // regardless of what the current call's input looks like. English never
  // hit this cache at all (serializeDetail only calls this for 'es'), which
  // is why only Spanish stayed broken.
  it('does not reuse a cached translation whose array lengths no longer match the current input', async () => {
    const id = 3
    const staleRecipe = { id, title: 'Combo', ingredientNames: [], instructionSteps: [] }
    mockCreate.mockResolvedValueOnce(completion({ title: 'Combo', ingredientNames: [], instructionSteps: [] }))
    const stale = await translateRecipeContent(staleRecipe, 'es')
    expect(stale.instructionSteps).toEqual([])
    expect(mockCreate).toHaveBeenCalledTimes(1)

    // Same recipe id, but the real (fixed) instructionSteps() extraction now
    // finds real steps — the stale 0-length cache entry must NOT be reused.
    const fixedRecipe = {
      id,
      title: 'Combo',
      ingredientNames: ['pita', 'falafel'],
      instructionSteps: ['Assemble the pita.', 'Add the falafel.'],
    }
    mockCreate.mockResolvedValueOnce(
      completion({
        title: 'Combo',
        ingredientNames: ['pita', 'falafel'],
        instructionSteps: ['Arma la pita.', 'Agrega el falafel.'],
      }),
    )
    const fixed = await translateRecipeContent(fixedRecipe, 'es')

    expect(fixed.instructionSteps).toEqual(['Arma la pita.', 'Agrega el falafel.'])
    expect(mockCreate).toHaveBeenCalledTimes(2) // re-translated instead of trusting the stale empty cache
  })

  it('falls back to the original English content when the JSON response is malformed', async () => {
    const recipe = { id: 4, title: 'Pasta', ingredientNames: ['flour'], instructionSteps: ['Boil water.'] }
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] })

    const result = await translateRecipeContent(recipe, 'es')
    expect(result).toEqual({ title: 'Pasta', ingredientNames: ['flour'], instructionSteps: ['Boil water.'] })
  })

  it('falls back to the original English content when the translated arrays have a different length', async () => {
    const recipe = { id: 5, title: 'Pasta', ingredientNames: ['flour', 'salt'], instructionSteps: ['Boil water.'] }
    mockCreate.mockResolvedValue(
      completion({ title: 'Pasta ES', ingredientNames: ['harina'], instructionSteps: ['Hervir agua.'] }),
    )

    const result = await translateRecipeContent(recipe, 'es')
    expect(result.ingredientNames).toEqual(['flour', 'salt'])
  })
})
