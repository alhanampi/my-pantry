import { Router, type Request, type Response } from 'express'
import { query, validationResult } from 'express-validator'
import { searchRecipes, getRecipeInformation } from '../services/spoonacular.js'
import { getEdamamRecipeInformation } from '../services/edamam.js'
import {
  serializeCard,
  serializeDetail,
  normalizeSpoonacularRecipe,
  normalizeEdamamRecipe,
  searchWithEdamamSupplement,
  parseRecipeId,
  handleSpoonacularError,
} from '../services/recipeSerializers.js'
import favoritesRouter from './recipeFavorites.js'

const router = Router()

const RESULTS_PER_PAGE = 4

// Mounted before the /:id catch-all below — Express matches route params
// against any single path segment, so a request for /favorites would
// otherwise be swallowed by GET /:id (id='favorites', parseInt -> NaN ->
// wrong 400) if this were registered after it.
router.use('/favorites', favoritesRouter)

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

      const supplemented = await searchWithEdamamSupplement(
        result,
        { query: q as string | undefined, includeIngredients: includeIngredients as string | undefined },
        RESULTS_PER_PAGE,
      )

      const results = await Promise.all(supplemented.recipes.map((r) => serializeCard(r, lang as string)))

      res.json({
        results,
        totalResults: supplemented.totalResults,
        offset: supplemented.offset,
        number: supplemented.number,
      })
    } catch (err) {
      handleSpoonacularError(err, res)
    }
  },
)

// GET /api/recipes/:id — :id is the compound "source:externalId" form
// produced by makeRecipeId (see recipeSerializers.ts), never a bare
// provider id.
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = parseRecipeId(req.params.id)
  if (!parsed) {
    res.status(400).json({ error: 'Invalid recipe id' })
    return
  }
  const lang = req.query.lang === 'es' ? 'es' : 'en'

  try {
    const normalized =
      parsed.source === 'spoonacular'
        ? normalizeSpoonacularRecipe(await getRecipeInformation(parseInt(parsed.externalId, 10)))
        : normalizeEdamamRecipe(await getEdamamRecipeInformation(parsed.externalId))
    const detail = await serializeDetail(normalized, lang)
    res.json({ recipe: detail })
  } catch (err) {
    handleSpoonacularError(err, res)
  }
})

export default router
