import type { Recipe } from '../utils/types'

const BASE = 'https://api.spoonacular.com'

function apiKey(): string {
  const key = import.meta.env.VITE_SPOONACULAR_KEY as string | undefined
  if (!key) throw new Error('Missing VITE_SPOONACULAR_KEY')
  return key
}

export interface FindByIngredientsOptions {
  /** Max number of results. Default 6, max 100. */
  number?: number
  /**
   * 1 = maximize used ingredients (fewest ignored pantry items)
   * 2 = minimize missing ingredients (recipes you can almost make right now)
   * Default: 2
   */
  ranking?: 1 | 2
  /** Ignore staples like water, salt, flour. Default true. */
  ignorePantry?: boolean
}

/**
 * Finds recipes that use the given ingredient names.
 * Ingredient names should be plain strings, e.g. ["pasta", "tomato", "chicken"].
 * Spoonacular does fuzzy matching so exact names are not required.
 */
export async function findRecipesByIngredients(
  ingredients: string[],
  options: FindByIngredientsOptions = {}
): Promise<Recipe[]> {
  if (ingredients.length === 0) return []

  const { number = 6, ranking = 2, ignorePantry = true } = options

  const params = new URLSearchParams({
    apiKey: apiKey(),
    ingredients: ingredients.join(','),
    number: String(number),
    ranking: String(ranking),
    ignorePantry: String(ignorePantry),
  })

  const res = await fetch(`${BASE}/recipes/findByIngredients?${params}`)

  if (res.status === 402) throw new Error('spoonacular.quotaExceeded')
  if (res.status === 401) throw new Error('spoonacular.invalidKey')
  if (!res.ok) throw new Error('spoonacular.error')

  return res.json() as Promise<Recipe[]>
}
