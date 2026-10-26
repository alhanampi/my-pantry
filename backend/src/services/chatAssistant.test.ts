import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapDietaryRestrictionsToSpoonacularDiet,
  resolveUnitSystem,
  translateIngredientNames,
  translateDishTitle,
  streamChatReply,
  extractSearchCriteria,
  suggestPossibleIngredients,
  SPOONACULAR_CUISINES,
} from './chatAssistant'

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

// Pins the exact contents of this duplicated list — there's no shared
// module between the frontend and backend packages to import a single
// source of truth from (see the comment on SPOONACULAR_CUISINES itself), so
// this at least forces an intentional test update (and a prompt to check
// src/utils/recipeFilterOptions.ts's CUISINE_OPTIONS too) whenever this
// side changes, rather than silently drifting.
describe('SPOONACULAR_CUISINES', () => {
  it('matches the frontend recipeFilterOptions.ts cuisine list exactly', () => {
    expect(SPOONACULAR_CUISINES).toEqual([
      'African', 'American', 'British', 'Cajun', 'Caribbean', 'Chinese', 'Eastern European', 'European',
      'French', 'German', 'Greek', 'Indian', 'Irish', 'Italian', 'Japanese', 'Jewish', 'Korean',
      'Latin American', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Nordic', 'Southern', 'Spanish',
      'Thai', 'Vietnamese',
    ])
  })
})

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

describe('translateDishTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('translates a dish title into English', async () => {
    mockCreate.mockResolvedValue(completion({ title: 'Chicken and rice' }))
    const result = await translateDishTitle('Arroz con pollo')
    expect(result).toBe('Chicken and rice')
  })

  it('propagates the error so the caller can decide how to fall back', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('down'), { status: 429 }))
    await expect(translateDishTitle('Arroz con pollo')).rejects.toThrow()
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

describe('streamChatReply dietary restrictions / servings framing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Chat conversations no longer go through an upfront dietary/servings
  // form (see ChatView's refactor) — every new conversation defaults to
  // dietaryRestrictions: [] and servings: 2, so the prompt must not claim
  // these were "already specified" by the user, or the model will stop
  // asking about servings even when the default is wrong for what's being
  // discussed.
  it('never says restrictions/servings were "already specified" by the user', async () => {
    mockCreate.mockResolvedValue(fakeStream(['hola']))

    await streamChatReply({
      history: [{ role: 'user', content: 'hola' }],
      language: 'es',
      dietaryRestrictions: [],
      servings: 2,
      unitSystem: 'metric',
      onToken: () => {},
    })

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).not.toContain('already specified')
    expect(system).not.toContain('already known')
  })

  it('omits the dietary-restrictions line entirely when none are set', async () => {
    mockCreate.mockResolvedValue(fakeStream(['hola']))

    await streamChatReply({
      history: [{ role: 'user', content: 'hola' }],
      language: 'es',
      dietaryRestrictions: [],
      servings: 2,
      unitSystem: 'metric',
      onToken: () => {},
    })

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).not.toContain('dietary restrictions:')
  })

  it('states dietary restrictions as a fact to honor when the conversation has them', async () => {
    mockCreate.mockResolvedValue(fakeStream(['hola']))

    await streamChatReply({
      history: [{ role: 'user', content: 'hola' }],
      language: 'es',
      dietaryRestrictions: ['vegetarian', 'glutenFree'],
      servings: 2,
      unitSystem: 'metric',
      onToken: () => {},
    })

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('vegetarian, glutenFree')
  })

  it('frames servings as a default that the conversation can override, not a confirmed fact', async () => {
    mockCreate.mockResolvedValue(fakeStream(['hola']))

    await streamChatReply({
      history: [{ role: 'user', content: 'hola' }],
      language: 'es',
      dietaryRestrictions: [],
      servings: 2,
      unitSystem: 'metric',
      onToken: () => {},
    })

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('Default assumption: 2 serving(s)')
    expect(system).toContain('never actually chosen')
  })
})

describe('extractSearchCriteria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Regression coverage for the reported bug: a conversation about "comida
  // árabe" was coming back with scones/unrelated recipes because the model
  // had no guidance to map a demonym/region that isn't itself in
  // SPOONACULAR_CUISINES onto the closest fixed entry, and would omit
  // cuisine instead of inferring "Middle Eastern".
  it('instructs the model to map demonyms/regions onto the closest fixed cuisine instead of omitting it', async () => {
    mockCreate.mockResolvedValue(completion({ cuisine: 'Middle Eastern' }))

    await extractSearchCriteria([{ role: 'user', content: 'quiero comida árabe' }])

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('Arabic')
    expect(system).toContain('Middle Eastern')
    expect(system).toContain('Prefer this kind of inference over omitting cuisine')
  })

  it('returns the cuisine the model extracted', async () => {
    mockCreate.mockResolvedValue(completion({ cuisine: 'Middle Eastern' }))
    const criteria = await extractSearchCriteria([{ role: 'user', content: 'quiero comida árabe' }])
    expect(criteria.cuisine).toBe('Middle Eastern')
  })

  it('returns an empty object when the model infers nothing', async () => {
    mockCreate.mockResolvedValue(completion({}))
    const criteria = await extractSearchCriteria([{ role: 'user', content: 'hola' }])
    expect(criteria).toEqual({})
  })
})

describe('suggestPossibleIngredients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asks for the suggestions in the conversation language, not translated to English', async () => {
    mockCreate.mockResolvedValue(completion({ ingredients: ['jengibre', 'ajo'] }))

    await suggestPossibleIngredients([{ role: 'user', content: 'quiero comida china' }], 'es')

    const system = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('Spanish')
    expect(system).toContain('do not translate them to English')
  })

  it('returns the suggested ingredients as-is', async () => {
    mockCreate.mockResolvedValue(completion({ ingredients: ['jengibre', 'ajo', 'salsa de soja'] }))
    const result = await suggestPossibleIngredients([{ role: 'user', content: 'quiero comida china' }], 'es')
    expect(result).toEqual(['jengibre', 'ajo', 'salsa de soja'])
  })

  it('returns an empty array when the model finds nothing concrete to suggest', async () => {
    mockCreate.mockResolvedValue(completion({ ingredients: [] }))
    const result = await suggestPossibleIngredients([{ role: 'user', content: 'hola' }], 'es')
    expect(result).toEqual([])
  })

  it('returns an empty array for a malformed/empty response instead of throwing', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] })
    const result = await suggestPossibleIngredients([{ role: 'user', content: 'hola' }], 'es')
    expect(result).toEqual([])
  })

  it('dedupes case-insensitively and caps the list at 6', async () => {
    mockCreate.mockResolvedValue(
      completion({ ingredients: ['Ajo', 'ajo', 'a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
    )
    const result = await suggestPossibleIngredients([{ role: 'user', content: 'hola' }], 'es')
    expect(result).toEqual(['Ajo', 'a', 'b', 'c', 'd', 'e'])
  })

  it('propagates quota/config errors like the other extraction helpers', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('down'), { status: 429 }))
    await expect(
      suggestPossibleIngredients([{ role: 'user', content: 'hola' }], 'es'),
    ).rejects.toThrow()
  })
})
