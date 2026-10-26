const BASE = 'https://api.edamam.com/api/recipes/v2'

// Fixed identifier sent as Edamam-Account-User — required by their v2 API
// for usage tracking. We don't have per-Edamam-account end users (unlike our
// own Clerk accounts), so every request from this app identifies itself the
// same way, per Edamam's own docs for a single-application integration.
const ACCOUNT_USER = 'mi-despensa-app'

export class EdamamQuotaError extends Error {
  constructor() {
    super('Edamam quota exceeded')
    this.name = 'EdamamQuotaError'
  }
}

export class EdamamAuthError extends Error {
  constructor() {
    super('Invalid Edamam credentials')
    this.name = 'EdamamAuthError'
  }
}

export class EdamamConfigError extends Error {
  constructor() {
    super('EDAMAM_APP_ID / EDAMAM_API_KEY are not configured')
    this.name = 'EdamamConfigError'
  }
}

function credentials(): { appId: string; appKey: string } {
  const appId = process.env.EDAMAM_APP_ID
  const appKey = process.env.EDAMAM_API_KEY
  if (!appId || !appKey) throw new EdamamConfigError()
  return { appId, appKey }
}

async function handle(res: Response): Promise<unknown> {
  if (res.status === 429) throw new EdamamQuotaError()
  if (res.status === 401 || res.status === 403) throw new EdamamAuthError()
  if (!res.ok) throw new Error(`Edamam error: ${res.status}`)
  return res.json()
}

// ── Shapes as returned by Edamam (subset we rely on) ────────────────────────

export interface EdamamIngredient {
  text: string
  quantity: number
  measure: string | null
  food: string
  weight: number
}

export interface EdamamRecipe {
  uri: string
  label: string
  image: string
  source: string
  url: string
  yield: number
  totalTime: number
  ingredientLines: string[]
  ingredients: EdamamIngredient[]
  totalNutrients: Record<string, { label: string; quantity: number; unit: string }>
  // Percent of daily recommended intake for the recipe AS A WHOLE (not per
  // serving) — recipeSerializers.ts divides by `yield` for a per-serving
  // estimate, same as it does for totalNutrients' absolute amounts.
  totalDaily: Record<string, { label: string; quantity: number; unit: string }>
}

interface EdamamSearchResponse {
  count: number
  hits: { recipe: EdamamRecipe }[]
}

export interface SearchEdamamParams {
  query?: string
  includeIngredients?: string
  // Edamam's own cuisineType vocabulary (lowercase, e.g. "middle eastern") —
  // already translated from Spoonacular's vocabulary by the caller (see
  // recipeSerializers.ts's SPOONACULAR_TO_EDAMAM_CUISINE), since the two
  // providers don't share one.
  cuisineType?: string
  number: number
}

// Edamam v2 has no offset/number params on the free plan — every call
// returns one fixed-size page from the start, so this is only ever used as
// a one-shot supplement (see the "thin Spoonacular results" fallback in
// routes/recipes.ts and routes/chat.ts), never paginated deeper.
export async function searchEdamamRecipes(params: SearchEdamamParams): Promise<EdamamRecipe[]> {
  const { appId, appKey } = credentials()

  // Edamam requires a non-empty `q` — fall back to a generic term rather
  // than skipping the call outright, so a fallback search with no specific
  // query/ingredients still gets real supplementary results.
  const q = [params.query, params.includeIngredients].filter(Boolean).join(' ').trim() || 'meal'

  const usp = new URLSearchParams({ type: 'public', q, app_id: appId, app_key: appKey })
  if (params.cuisineType) usp.set('cuisineType', params.cuisineType)

  const res = await fetch(`${BASE}?${usp.toString()}`, {
    headers: { 'Edamam-Account-User': ACCOUNT_USER },
  })
  const data = (await handle(res)) as EdamamSearchResponse
  return data.hits.slice(0, params.number).map((h) => h.recipe)
}

// Edamam's own uri (e.g. "http://www.edamam.com/ontologies/edamam.owl#recipe_abc123")
// doubles as the lookup id — no separate numeric id exists, unlike Spoonacular.
export async function getEdamamRecipeInformation(uri: string): Promise<EdamamRecipe> {
  const { appId, appKey } = credentials()
  // The by-uri endpoint takes the uri as `r`, not `uri` — different param
  // name from every other Edamam endpoint, per their own docs.
  const usp = new URLSearchParams({ type: 'public', r: uri, app_id: appId, app_key: appKey })

  const res = await fetch(`${BASE}/by-uri?${usp.toString()}`, {
    headers: { 'Edamam-Account-User': ACCOUNT_USER },
  })
  const data = (await handle(res)) as EdamamSearchResponse
  const recipe = data.hits[0]?.recipe
  if (!recipe) throw new Error('Edamam recipe not found')
  return recipe
}
