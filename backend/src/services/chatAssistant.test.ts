import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapDietaryRestrictionsToSpoonacularDiet,
  resolveUnitSystem,
  translateIngredientNames,
  streamChatReply,
} from './chatAssistant'

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

describe('mapDietaryRestrictionsToSpoonacularDiet', () => {
  it('maps pescetarian and paleo chips onto their Spoonacular diet values', () => {
    expect(mapDietaryRestrictionsToSpoonacularDiet(['pescetarian'])).toBe('pescetarian')
    expect(mapDietaryRestrictionsToSpoonacularDiet(['paleo'])).toBe('paleo')
  })

  it('still maps the original four chips', () => {
    expect(mapDietaryRestrictionsToSpoonacularDiet(['vegetarian'])).toBe('vegetarian')
    expect(mapDietaryRestrictionsToSpoonacularDiet(['vegan'])).toBe('vegan')
    expect(mapDietaryRestrictionsToSpoonacularDiet(['glutenFree'])).toBe('glutenFree')
    expect(mapDietaryRestrictionsToSpoonacularDiet(['keto'])).toBe('ketogenic')
  })

  it('returns undefined for chips with no direct Spoonacular equivalent (lowSodium, eggFree, custom text)', () => {
    expect(mapDietaryRestrictionsToSpoonacularDiet(['lowSodium'])).toBeUndefined()
    expect(mapDietaryRestrictionsToSpoonacularDiet(['eggFree'])).toBeUndefined()
    expect(mapDietaryRestrictionsToSpoonacularDiet(['sin maní'])).toBeUndefined()
  })

  it('returns undefined for an empty list', () => {
    expect(mapDietaryRestrictionsToSpoonacularDiet([])).toBeUndefined()
  })

  it('picks the first matching restriction when multiple are given', () => {
    expect(mapDietaryRestrictionsToSpoonacularDiet(['lowSodium', 'vegan'])).toBe('vegan')
  })
})

describe('resolveUnitSystem', () => {
  it('returns the explicit choice regardless of language', () => {
    expect(resolveUnitSystem('imperial', 'es')).toBe('imperial')
    expect(resolveUnitSystem('metric', 'en')).toBe('metric')
  })

  it('defaults to metric for Spanish when never explicitly chosen', () => {
    expect(resolveUnitSystem(null, 'es')).toBe('metric')
    expect(resolveUnitSystem(undefined, 'es')).toBe('metric')
  })

  it('defaults to imperial for any other language when never explicitly chosen', () => {
    expect(resolveUnitSystem(null, 'en')).toBe('imperial')
  })

  it('ignores a garbage stored value and falls back to the locale default', () => {
    expect(resolveUnitSystem('bogus', 'es')).toBe('metric')
  })
})

function completion(content: unknown) {
  return { choices: [{ message: { content: JSON.stringify(content) } }] }
}

// Minimal async-iterable stand-in for Groq's streamed chat completion —
// streamChatReply does `for await (const chunk of stream)`.
async function* fakeStream(tokens: string[]) {
  for (const t of tokens) yield { choices: [{ delta: { content: t } }] }
}

describe('translateIngredientNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array without calling Groq', async () => {
    const result = await translateIngredientNames([])
    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('translates a list of pantry item names into English, preserving order', async () => {
    mockCreate.mockResolvedValue(completion({ names: ['Rice', 'Chicken'] }))
    const result = await translateIngredientNames(['Arroz', 'Pollo'])
    expect(result).toEqual(['Rice', 'Chicken'])
  })

  // Unlike groq.ts's translateRecipeContent (fails soft to English), a
  // translation failure here must propagate — silently falling back to the
  // original (possibly Spanish) names would make the caller's Spoonacular
  // query quietly return nothing instead of surfacing a real error.
  it('propagates the error instead of falling back to the original names', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('down'), { status: 429 }))
    await expect(translateIngredientNames(['Arroz'])).rejects.toThrow()
  })
})

describe('streamChatReply pantrySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes the pantry contents in the system prompt when pantrySummary is given', async () => {
    mockCreate.mockResolvedValue(fakeStream(['hola']))

    await streamChatReply({
      history: [{ role: 'user', content: 'hola' }],
      language: 'es',
      dietaryRestrictions: [],
      servings: 2,
      unitSystem: 'metric',
      pantrySummary: 'Arroz, Pollo',
      onToken: () => {},
    })

    const call = mockCreate.mock.calls[0][0]
    const system = call.messages[0].content as string
    expect(system).toContain('Arroz, Pollo')
  })

  it('omits any pantry mention when pantrySummary is not given', async () => {
    mockCreate.mockResolvedValue(fakeStream(['hola']))

    await streamChatReply({
      history: [{ role: 'user', content: 'hola' }],
      language: 'es',
      dietaryRestrictions: [],
      servings: 2,
      unitSystem: 'metric',
      onToken: () => {},
    })

    const call = mockCreate.mock.calls[0][0]
    const system = call.messages[0].content as string
    expect(system).not.toContain('pantry right now')
  })
})
