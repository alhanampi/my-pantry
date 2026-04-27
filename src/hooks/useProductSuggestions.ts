import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { fetchProductSuggestions } from '../api/productSuggestionsApi'
import type { ProductSuggestion } from '../utils/types'

const MIN_LENGTH = 2

export function useProductSuggestions(
  query: string,
  language: string
): UseQueryResult<ProductSuggestion[], Error> {
  return useQuery<ProductSuggestion[], Error>({
    queryKey: ['product-suggestions', query, language],
    queryFn: () => fetchProductSuggestions(query, language),
    enabled: query.length >= MIN_LENGTH,
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  })
}
