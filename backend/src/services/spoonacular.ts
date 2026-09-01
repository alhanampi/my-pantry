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
  percentOfDailyNeeds?: number
}

interface SpoonacularMeasure {
  amount: number
  unitShort: string
  unitLong: string
}

interface SpoonacularIngredient {
  id: number
  name: string
  amount: number
  unit: string
  original: string
  image?: string
  // Present on every ingredient whenever fillIngredients=true/includeNutrition=true
  // are requested (both already are, below) — Spoonacular returns both unit
  // systems per ingredient regardless of any `unit` request param, so the
  // metric/imperial toggle can convert client-side with no extra request.
  measures?: { us: SpoonacularMeasure; metric: SpoonacularMeasure }
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
  maxReadyTime?: number
  number: number
  offset: number
}

export async function searchRecipes(params: SearchRecipesParams): Promise<ComplexSearchResponse> {
  const usp = new URLSearchParams({
    apiKey: apiKey(),
    addRecipeInformation: 'true',
    addRecipeNutrition: 'true',
    fillIngredients: 'true',
    // Always random (even with query/filters active) per product decision —
    // results reshuffle on every request rather than sorting by relevance.
    // Trade-off accepted: since Spoonacular re-randomizes per call rather
    // than taking a stable seed, consecutive offset-paginated pages during
    // one infinite-scroll session can occasionally repeat or skip a recipe.
    sort: 'random',
    number: String(params.number),
    offset: String(params.offset),
  })
  if (params.query) usp.set('query', params.query)
  if (params.cuisine) usp.set('cuisine', params.cuisine)
  if (params.diet) usp.set('diet', params.diet)
  if (params.includeIngredients) usp.set('includeIngredients', params.includeIngredients)
  if (params.maxCalories) usp.set('maxCalories', String(params.maxCalories))
  if (params.maxReadyTime) usp.set('maxReadyTime', String(params.maxReadyTime))

  const res = await fetch(`${BASE}/recipes/complexSearch?${usp.toString()}`)
  return (await handle(res)) as ComplexSearchResponse
}

// Progressive relaxation for a criteria-driven search that must not come
// back empty in practice. Combining every extracted field at once (query +
// includeIngredients + cuisine + diet + maxReadyTime, all ANDed by
// complexSearch) is easy to over-constrain to zero results even when each
// field individually would match something. Tries the fullest criteria
// first, then relaxes step by step, stopping at the first non-empty result
// — the last step drops every optional field, which Spoonacular's own
// random sort (see searchRecipes above) always answers with real recipes.
export interface FallbackSearchCriteria {
  query?: string
  cuisine?: string
  includeIngredients?: string
  maxReadyTime?: number
  diet?: string
}

export async function searchRecipesWithFallback(
  criteria: FallbackSearchCriteria,
  number: number,
): Promise<ComplexSearchResponse> {
  const { query, cuisine, includeIngredients, maxReadyTime, diet } = criteria

  const attempts: SearchRecipesParams[] = [
    // 1. Everything the AI extracted, as-is.
    { query, cuisine, includeIngredients, maxReadyTime, diet, number, offset: 0 },
    // 2. Drop the most likely culprits for over-constraining: the time
    //    window and the cuisine tag.
    { query, includeIngredients, diet, number, offset: 0 },
    // 3. Keep only one main term (prefer includeIngredients — it's closer
    //    to "what the user actually has") plus diet.
    { ...(includeIngredients ? { includeIngredients } : { query }), diet, number, offset: 0 },
    // 4. No filters at all — guaranteed non-empty via Spoonacular's random
    //    sort.
    { number, offset: 0 },
  ]

  let last: ComplexSearchResponse = { results: [], offset: 0, number, totalResults: 0 }
  for (const params of attempts) {
    const result = await searchRecipes(params)
    if (result.results.length > 0) return result
    last = result
  }
  return last
}

export async function getRecipeInformation(id: number): Promise<SpoonacularRecipe> {
  const usp = new URLSearchParams({ apiKey: apiKey(), includeNutrition: 'true' })
  const res = await fetch(`${BASE}/recipes/${id}/information?${usp.toString()}`)
  return (await handle(res)) as SpoonacularRecipe
}
