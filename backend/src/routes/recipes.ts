import { Router, type Request, type Response } from 'express'
import { query, validationResult } from 'express-validator'
import { searchRecipes, getRecipeInformation } from '../services/spoonacular.js'
import { serializeCard, serializeDetail, handleSpoonacularError } from '../services/recipeSerializers.js'
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
