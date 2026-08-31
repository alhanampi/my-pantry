import type { Response } from 'express'
import {
  SpoonacularQuotaError,
  SpoonacularAuthError,
  SpoonacularConfigError,
  type SpoonacularRecipe,
} from './spoonacular.js'
import { translateRecipeContent } from './groq.js'

// Shared between routes/recipes.ts (search + detail) and
// routes/recipeFavorites.ts (favorites list hydration) — both need to turn a
// raw SpoonacularRecipe into the same translated RecipeCard/RecipeDetail
// shapes the frontend expects, so this lives here instead of being
// duplicated per route file.

export function nutrientValue(recipe: SpoonacularRecipe, name: string): number {
  const n = recipe.nutrition?.nutrients.find((x) => x.name === name)
  return n ? Math.round(n.amount) : 0
}

export function ingredientNames(recipe: SpoonacularRecipe): string[] {
  return (recipe.extendedIngredients ?? []).map((i) => i.name)
}

export function instructionSteps(recipe: SpoonacularRecipe): string[] {
  const steps = recipe.analyzedInstructions?.[0]?.steps
  if (steps && steps.length > 0) return steps.map((s) => s.step)
  return recipe.instructions ? [recipe.instructions] : []
}

export async function serializeCard(recipe: SpoonacularRecipe, lang: string) {
  const names = ingredientNames(recipe)
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
    title,
    image: recipe.image,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    ingredientNames: names,
    calories: nutrientValue(recipe, 'Calories'),
  }
}

export async function serializeDetail(recipe: SpoonacularRecipe, lang: string) {
  const names = ingredientNames(recipe)
  const steps = instructionSteps(recipe)
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

  const ingredients = (recipe.extendedIngredients ?? []).map((ing, idx) => ({
    id: ing.id,
    name: translatedNames[idx] ?? ing.name,
    amount: ing.amount,
    unit: ing.unit,
    original: ing.original,
  }))

  return {
    id: recipe.id,
    title,
    image: recipe.image,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    ingredients,
    instructions: translatedSteps,
    nutrition: {
      calories: nutrientValue(recipe, 'Calories'),
      protein: nutrientValue(recipe, 'Protein'),
      carbs: nutrientValue(recipe, 'Carbohydrates'),
      fat: nutrientValue(recipe, 'Fat'),
    },
  }
}

export function handleSpoonacularError(err: unknown, res: Response): void {
  if (err instanceof SpoonacularQuotaError) {
    res.status(503).json({ error: 'quotaExceeded' })
    return
  }
  if (err instanceof SpoonacularConfigError || err instanceof SpoonacularAuthError) {
    res.status(500).json({ error: 'configError' })
    return
  }
  res.status(500).json({ error: 'Server error' })
}
