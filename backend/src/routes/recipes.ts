import { Router, type Request, type Response } from 'express'
import { query, validationResult } from 'express-validator'
import {
  searchRecipes,
  getRecipeInformation,
  SpoonacularQuotaError,
  SpoonacularAuthError,
  SpoonacularConfigError,
  type SpoonacularRecipe,
} from '../services/spoonacular.js'
import { translateRecipeContent } from '../services/groq.js'

const router = Router()

const RESULTS_PER_PAGE = 4

function nutrientValue(recipe: SpoonacularRecipe, name: string): number {
  const n = recipe.nutrition?.nutrients.find((x) => x.name === name)
  return n ? Math.round(n.amount) : 0
}

function ingredientNames(recipe: SpoonacularRecipe): string[] {
  return (recipe.extendedIngredients ?? []).map((i) => i.name)
}

function instructionSteps(recipe: SpoonacularRecipe): string[] {
  const steps = recipe.analyzedInstructions?.[0]?.steps
  if (steps && steps.length > 0) return steps.map((s) => s.step)
  return recipe.instructions ? [recipe.instructions] : []
}

async function serializeCard(recipe: SpoonacularRecipe, lang: string) {
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

async function serializeDetail(recipe: SpoonacularRecipe, lang: string) {
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

function handleSpoonacularError(err: unknown, res: Response): void {
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

// GET /api/recipes/search
router.get(
  '/search',
  [
    query('query').optional().isString(),
    query('cuisine').optional().isString(),
    query('diet').optional().isString(),
    query('includeIngredients').optional().isString(),
    query('maxCalories').optional().isInt({ min: 0 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('lang').optional().isIn(['en', 'es']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg })
      return
    }

    try {
      const {
        query: q,
        cuisine,
        diet,
        includeIngredients,
        maxCalories,
        offset = 0,
        lang = 'en',
      } = req.query as Record<string, string | number | undefined>

      const result = await searchRecipes({
        query: q as string | undefined,
        cuisine: cuisine as string | undefined,
        diet: diet as string | undefined,
        includeIngredients: includeIngredients as string | undefined,
        maxCalories: maxCalories as number | undefined,
        number: RESULTS_PER_PAGE,
        offset: Number(offset),
      })

      const results = await Promise.all(result.results.map((r) => serializeCard(r, lang as string)))

      res.json({
        results,
        totalResults: result.totalResults,
        offset: result.offset,
        number: result.number,
      })
    } catch (err) {
      handleSpoonacularError(err, res)
    }
  },
)

// GET /api/recipes/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid recipe id' })
    return
  }
  const lang = req.query.lang === 'es' ? 'es' : 'en'

  try {
    const recipe = await getRecipeInformation(id)
    const detail = await serializeDetail(recipe, lang)
    res.json({ recipe: detail })
  } catch (err) {
    handleSpoonacularError(err, res)
  }
})

export default router
