import { describe, it, expect } from 'vitest'
import { mapDietaryRestrictionsToSpoonacularDiet } from './chatAssistant'

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
