import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { RecipeSearchFilters, RecipeSearchResponse, RecipeDetail } from '../utils/types'
import { apiSearchRecipes, apiGetRecipeDetail, apiGetRandomRecipes } from '../api/recipesApi'

// NOTE — deliberate exception to docs/data-fetching.md's "enabled:
// !!isSignedIn" rule: /api/recipes is a public endpoint (no auth), so recipe
// browsing works for guests too. See the note added to docs/data-fetching.md.

// `enabled` defaults to true — RecipesView passes false while showing the
// landing-state PantryAndRandomSuggestions instead of search results, so an
// all-empty-filters search isn't fired in parallel with that section's own
// random-recipes query.
export function useRecipeSearch(filters: RecipeSearchFilters, enabled = true) {
  const { i18n } = useTranslation()

  return useInfiniteQuery({
    queryKey: ['recipes', 'search', filters, i18n.language],
    queryFn: ({ pageParam }): Promise<RecipeSearchResponse> =>
      apiSearchRecipes(filters, pageParam, i18n.language),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.number
      return nextOffset < lastPage.totalResults ? nextOffset : undefined
    },
    enabled,
  })
}

// Matches the backend's RESULTS_PER_PAGE (backend/src/routes/recipes.ts) —
// each offset bump is one full page of random recipes, not a partial one.
const RANDOM_SUGGESTIONS_PER_PAGE = 4

// RecipesView's "o probá estas opciones" section — bumping `offset` (rather
// than refetching the same one) is what makes "Más sugerencias" show a
// genuinely different batch instead of a cached repeat (see
// apiGetRandomRecipes's own comment).
export function useRandomRecipeSuggestions() {
  const { i18n } = useTranslation()
  const [offset, setOffset] = useState(0)

  const query = useQuery({
    queryKey: ['recipes', 'randomSuggestions', offset, i18n.language],
    queryFn: (): Promise<RecipeSearchResponse> => apiGetRandomRecipes(offset, i18n.language),
  })

  return { ...query, loadMore: () => setOffset((prev) => prev + RANDOM_SUGGESTIONS_PER_PAGE) }
}

export function useRecipeDetail(id: string | null) {
  const { i18n } = useTranslation()

  return useQuery({
    queryKey: ['recipes', 'detail', id, i18n.language],
    queryFn: (): Promise<RecipeDetail> => apiGetRecipeDetail(id!, i18n.language),
    enabled: id !== null,
  })
}
