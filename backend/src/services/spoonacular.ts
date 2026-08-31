const BASE = 'https://api.spoonacular.com'

export class SpoonacularQuotaError extends Error {
  constructor() {
    super('Spoonacular quota exceeded')
    this.name = 'SpoonacularQuotaError'
  }
}

export class SpoonacularAuthError extends Error {
  constructor() {
    super('Invalid Spoonacular API key')
    this.name = 'SpoonacularAuthError'
  }
}

export class SpoonacularConfigError extends Error {
  constructor() {
    super('SPOONACULAR_KEY is not configured')
    this.name = 'SpoonacularConfigError'
  }
}

function apiKey(): string {
  const key = process.env.SPOONACULAR_KEY
  if (!key) throw new SpoonacularConfigError()
  return key
}

async function handle(res: Response): Promise<unknown> {
  if (res.status === 402) throw new SpoonacularQuotaError()
  if (res.status === 401) throw new SpoonacularAuthError()
  if (!res.ok) throw new Error(`Spoonacular error: ${res.status}`)
  return res.json()
}

// ── Shapes as returned by Spoonacular (subset we rely on) ──────────────────────

interface SpoonacularNutrient {
  name: string
  amount: number
  unit: string
}

interface SpoonacularIngredient {
  id: number
  name: string
  amount: number
  unit: string
  original: string
  image?: string
}

export interface SpoonacularRecipe {
  id: number
  title: string
  image: string
  servings: number
  readyInMinutes: number
  sourceUrl?: string
  summary?: string
  instructions?: string
  analyzedInstructions?: { steps: { number: number; step: string }[] }[]
  extendedIngredients?: SpoonacularIngredient[]
  nutrition?: { nutrients: SpoonacularNutrient[] }
}

interface ComplexSearchResponse {
  results: SpoonacularRecipe[]
  offset: number
  number: number
  totalResults: number
}

export interface SearchRecipesParams {
  query?: string
  cuisine?: string
  diet?: string
  includeIngredients?: string
  maxCalories?: number
  number: number
  offset: number
}

export async function searchRecipes(params: SearchRecipesParams): Promise<ComplexSearchResponse> {
  const usp = new URLSearchParams({
    apiKey: apiKey(),
    addRecipeInformation: 'true',
    addRecipeNutrition: 'true',
    number: String(params.number),
    offset: String(params.offset),
  })
  if (params.query) usp.set('query', params.query)
  if (params.cuisine) usp.set('cuisine', params.cuisine)
  if (params.diet) usp.set('diet', params.diet)
  if (params.includeIngredients) usp.set('includeIngredients', params.includeIngredients)
  if (params.maxCalories) usp.set('maxCalories', String(params.maxCalories))

  const res = await fetch(`${BASE}/recipes/complexSearch?${usp.toString()}`)
  return (await handle(res)) as ComplexSearchResponse
}

export async function getRecipeInformation(id: number): Promise<SpoonacularRecipe> {
  const usp = new URLSearchParams({ apiKey: apiKey(), includeNutrition: 'true' })
  const res = await fetch(`${BASE}/recipes/${id}/information?${usp.toString()}`)
  return (await handle(res)) as SpoonacularRecipe
}
