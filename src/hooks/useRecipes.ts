import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { RecipeSearchFilters, RecipeSearchResponse, RecipeDetail } from '../utils/types'
import { apiSearchRecipes, apiGetRecipeDetail } from '../api/recipesApi'

// NOTE — deliberate exception to docs/data-fetching.md's "enabled:
// !!isSignedIn" rule: /api/recipes is a public endpoint (no auth), so recipe
// browsing works for guests too. See the note added to docs/data-fetching.md.

export function useRecipeSearch(filters: RecipeSearchFilters) {
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
  })
}

export function useRecipeDetail(id: number | null) {
  const { i18n } = useTranslation()

  return useQuery({
    queryKey: ['recipes', 'detail', id, i18n.language],
    queryFn: (): Promise<RecipeDetail> => apiGetRecipeDetail(id!, i18n.language),
    enabled: id !== null,
  })
}
