import type { Response } from 'express'
import {
  SpoonacularQuotaError,
  SpoonacularAuthError,
  SpoonacularConfigError,
  type SpoonacularRecipe,
} from './spoonacular.js'
import {
  EdamamQuotaError,
  EdamamAuthError,
  EdamamConfigError,
  searchEdamamRecipes,
  type EdamamRecipe,
} from './edamam.js'
import { translateRecipeContent } from './groq.js'

// Shared between routes/recipes.ts (search + detail), routes/recipeFavorites.ts
// (favorites list hydration), and routes/chat.ts (chat suggestions, pantry
// suggestions, meal plan) — both recipe providers get normalized into the
// same NormalizedRecipe shape here, then a single serializeCard/serializeDetail
// pair (translation included) works the same regardless of source.

export type RecipeSource = 'spoonacular' | 'edamam'

// Compound id — "spoonacular:<id>" / "edamam:<uri>" — is the only id that
// ever leaves this backend. Spoonacular's own numeric ids and Edamam's uri
// strings are never exposed directly, since routes need to know which
// provider to dispatch a detail/favorite/consolidate lookup back to.
//
// Deliberately NOT percent-encoded here: a JSON body value (POST
// /favorites) is never URL-decoded, so encoding it here and never decoding
// it back would leave a mangled string in the DB. When this id needs to go
// into a URL *path* segment instead (GET /recipes/:id, DELETE
// /favorites/:recipeId), the frontend encodeURIComponent()s the whole
// compound string, and Express decodes it exactly once when parsing
// req.params — parseRecipeId below never needs to decode anything itself.
export function makeRecipeId(source: RecipeSource, externalId: string | number): string {
  return `${source}:${externalId}`
}

export interface ParsedRecipeId {
  source: RecipeSource
  externalId: string
}

// Returns null for anything that isn't a recognized "source:externalId"
// pair — callers respond 400 rather than guessing.
export function parseRecipeId(id: string): ParsedRecipeId | null {
  const sepIndex = id.indexOf(':')
  if (sepIndex === -1) return null
  const source = id.slice(0, sepIndex)
  const externalId = id.slice(sepIndex + 1)
  if (source !== 'spoonacular' && source !== 'edamam') return null
  if (!externalId) return null
  return { source, externalId }
}

export interface NormalizedIngredient {
  id: number | string
  name: string
  amount: number
  unit: string
  original: string
  // Edamam gives one measurement system only — both fields carry the same
  // value there, unlike Spoonacular's genuinely distinct metric/us pair.
  measures: { metric: { amount: number; unit: string }; us: { amount: number; unit: string } }
}

export interface NormalizedRecipe {
  id: string
  source: RecipeSource
  title: string
  image: string
  servings: number
  readyInMinutes: number
  sourceUrl?: string
  ingredients: NormalizedIngredient[]
  // Spoonacular gives real step-by-step instructions; Edamam only gives a
  // link to the original recipe, so this is a single-item array pointing
  // there for Edamam-sourced recipes (see serializeDetail's Edamam note).
  instructions: string[]
  nutrition: { calories: number; protein: number; carbs: number; fat: number; caloriesPercent: number; proteinPercent: number; carbsPercent: number; fatPercent: number }
}

function nutrientValue(recipe: SpoonacularRecipe, name: string): number {
  const n = recipe.nutrition?.nutrients.find((x) => x.name === name)
  return n ? Math.round(n.amount) : 0
}

function nutrientPercent(recipe: SpoonacularRecipe, name: string): number {
  const n = recipe.nutrition?.nutrients.find((x) => x.name === name)
  return n?.percentOfDailyNeeds ? Math.round(n.percentOfDailyNeeds) : 0
}

// Flattens across every group in analyzedInstructions, not just the first —
// Spoonacular sometimes splits a recipe into more than one group (e.g. a
// separate "Marinade" section before "Instructions"); reading only [0]
// silently dropped real steps whenever that first group happened to be
// empty. If there's truly no analyzedInstructions data at all, fall back to
// the raw `instructions` HTML string — stripped of tags and collapsed to
// plain text — rather than dumping markup into a single list item.
function spoonacularInstructionSteps(recipe: SpoonacularRecipe): string[] {
  const allSteps = (recipe.analyzedInstructions ?? []).flatMap((group) => group.steps ?? [])
  if (allSteps.length > 0) return allSteps.map((s) => s.step)

  if (!recipe.instructions) return []
  const plain = recipe.instructions.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain ? [plain] : []
}

export function normalizeSpoonacularRecipe(recipe: SpoonacularRecipe): NormalizedRecipe {
  const ingredients: NormalizedIngredient[] = (recipe.extendedIngredients ?? []).map((ing) => {
    const fallback = { amount: ing.amount, unit: ing.unit }
    const us = ing.measures ? { amount: ing.measures.us.amount, unit: ing.measures.us.unitShort } : fallback
    const metric = ing.measures
      ? { amount: ing.measures.metric.amount, unit: ing.measures.metric.unitShort }
      : fallback
    return { id: ing.id, name: ing.name, amount: metric.amount, unit: metric.unit, original: ing.original, measures: { metric, us } }
  })

  return {
    id: makeRecipeId('spoonacular', recipe.id),
    source: 'spoonacular',
    title: recipe.title,
    image: recipe.image,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    sourceUrl: recipe.sourceUrl,
    ingredients,
    instructions: spoonacularInstructionSteps(recipe),
    nutrition: {
      calories: nutrientValue(recipe, 'Calories'),
      protein: nutrientValue(recipe, 'Protein'),
      carbs: nutrientValue(recipe, 'Carbohydrates'),
      fat: nutrientValue(recipe, 'Fat'),
      caloriesPercent: nutrientPercent(recipe, 'Calories'),
      proteinPercent: nutrientPercent(recipe, 'Protein'),
      carbsPercent: nutrientPercent(recipe, 'Carbohydrates'),
      fatPercent: nutrientPercent(recipe, 'Fat'),
    },
  }
}

function edamamNutrientPerServing(recipe: EdamamRecipe, key: string): number {
  const total = recipe.totalNutrients[key]?.quantity ?? 0
  const servings = recipe.yield || 1
  return Math.round(total / servings)
}

function edamamDailyPercentPerServing(recipe: EdamamRecipe, key: string): number {
  const total = recipe.totalDaily?.[key]?.quantity ?? 0
  const servings = recipe.yield || 1
  return Math.round(total / servings)
}

export function normalizeEdamamRecipe(recipe: EdamamRecipe): NormalizedRecipe {
  const ingredients: NormalizedIngredient[] = recipe.ingredients.map((ing, idx) => {
    const amount = ing.quantity ?? 0
    const unit = ing.measure ?? ''
    return {
      id: idx,
      name: ing.food || ing.text,
      amount,
      unit,
      original: ing.text,
      measures: { metric: { amount, unit }, us: { amount, unit } },
    }
  })

  return {
    id: makeRecipeId('edamam', recipe.uri),
    source: 'edamam',
    title: recipe.label,
    image: recipe.image,
    servings: recipe.yield || 1,
    readyInMinutes: recipe.totalTime || 0,
    sourceUrl: recipe.url,
    ingredients,
    // No step-by-step instructions from Edamam — serializeDetail turns this
    // single entry into a "see the full recipe at {url}" line, translated
    // like any other instruction text.
    instructions: [recipe.url],
    nutrition: {
      calories: edamamNutrientPerServing(recipe, 'ENERC_KCAL'),
      protein: edamamNutrientPerServing(recipe, 'PROCNT'),
      carbs: edamamNutrientPerServing(recipe, 'CHOCDF'),
      fat: edamamNutrientPerServing(recipe, 'FAT'),
      caloriesPercent: edamamDailyPercentPerServing(recipe, 'ENERC_KCAL'),
      proteinPercent: edamamDailyPercentPerServing(recipe, 'PROCNT'),
      carbsPercent: edamamDailyPercentPerServing(recipe, 'CHOCDF'),
      fatPercent: edamamDailyPercentPerServing(recipe, 'FAT'),
    },
  }
}

export interface SupplementedSearchResult {
  recipes: NormalizedRecipe[]
  totalResults: number
  offset: number
  number: number
}

// Spoonacular is the primary source; Edamam only fills in the remainder when
// Spoonacular's own search (plain or already relaxed via
// searchRecipesWithFallback) came back thinner than what was asked for.
// Edamam's free plan has no offset/pagination (see searchEdamamRecipes's own
// comment) — it only makes sense as a one-shot supplement to the very first
// page, so it's never called for offset > 0 (every later infinite-scroll
// page would otherwise re-fetch and re-append that same fixed page).
// Any Edamam-side failure (quota/auth/config/network) is swallowed here —
// Spoonacular already answered, so a broken Edamam integration must not turn
// a 200 into a 500.
export async function searchWithEdamamSupplement(
  spoonacularResult: { results: SpoonacularRecipe[]; offset: number; number: number; totalResults: number },
  edamamParams: { query?: string; includeIngredients?: string },
  requestedNumber: number,
): Promise<SupplementedSearchResult> {
  const recipes = spoonacularResult.results.map(normalizeSpoonacularRecipe)
  let totalResults = spoonacularResult.totalResults

  if (recipes.length < requestedNumber && spoonacularResult.offset === 0) {
    try {
      const edamamRecipes = await searchEdamamRecipes({
        query: edamamParams.query,
        includeIngredients: edamamParams.includeIngredients,
        number: requestedNumber - recipes.length,
      })
      recipes.push(...edamamRecipes.map(normalizeEdamamRecipe))
      totalResults += edamamRecipes.length
    } catch (err) {
      console.warn('Edamam search supplement failed, continuing with Spoonacular-only results', err)
    }
  }

  return { recipes, totalResults, offset: spoonacularResult.offset, number: requestedNumber }
}

export async function serializeCard(recipe: NormalizedRecipe, lang: string) {
  const names = recipe.ingredients.map((i) => i.name)
  let title = recipe.title
  if (lang === 'es') {
    const translated = await translateRecipeContent(
      { id: recipe.id, title: recipe.title, ingredientNames: names, instructionSteps: [] },
      lang,
    )
    title = translated.title
  }
  return {
    id: recipe.id,
    source: recipe.source,
    title,
    image: recipe.image,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    ingredientNames: names,
    calories: recipe.nutrition.calories,
    sourceUrl: recipe.sourceUrl,
  }
}

export async function serializeDetail(recipe: NormalizedRecipe, lang: string) {
  const names = recipe.ingredients.map((i) => i.name)
  const steps = recipe.instructions
  let title = recipe.title
  let translatedNames = names
  let translatedSteps = steps
  if (lang === 'es') {
    const translated = await translateRecipeContent(
      { id: recipe.id, title: recipe.title, ingredientNames: names, instructionSteps: steps },
      lang,
    )
    title = translated.title
    translatedNames = translated.ingredientNames
    translatedSteps = translated.instructionSteps
  }

  const ingredients = recipe.ingredients.map((ing, idx) => ({
    ...ing,
    name: translatedNames[idx] ?? ing.name,
  }))

  return {
    id: recipe.id,
    source: recipe.source,
    title,
    image: recipe.image,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    sourceUrl: recipe.sourceUrl,
    ingredients,
    instructions: translatedSteps,
    nutrition: recipe.nutrition,
  }
}

// Name kept from before Edamam existed (every call site already imports it
// under this name) — handles both providers' error classes now.
export function handleSpoonacularError(err: unknown, res: Response): void {
  if (err instanceof SpoonacularQuotaError || err instanceof EdamamQuotaError) {
    res.status(503).json({ error: 'quotaExceeded' })
    return
  }
  if (
    err instanceof SpoonacularConfigError ||
    err instanceof SpoonacularAuthError ||
    err instanceof EdamamConfigError ||
    err instanceof EdamamAuthError
  ) {
    res.status(500).json({ error: 'configError' })
    return
  }
  res.status(500).json({ error: 'Server error' })
}
