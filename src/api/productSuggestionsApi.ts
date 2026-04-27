import axios from 'axios'
import type { ProductSuggestion } from '../utils/types'

interface OFFProduct {
  product_name?: string
  generic_name?: string
  categories_tags?: string[]
}

interface OFFResponse {
  products: OFFProduct[]
}

function extractCategory(tags: string[] | undefined, language: string): string {
  if (!tags?.length) return ''
  const preferred = tags.find((t) => t.startsWith(`${language}:`))
  const fallback = tags.find((t) => t.startsWith('en:')) ?? tags[tags.length - 1]
  const raw = preferred ?? fallback ?? ''
  return raw.replace(/^\w+:/, '').replace(/-/g, ' ')
}

export async function fetchProductSuggestions(
  query: string,
  language: string
): Promise<ProductSuggestion[]> {
  const { data } = await axios.get<OFFResponse>('https://world.openfoodfacts.org/api/v2/search', {
    params: {
      search_terms: query,
      page_size: 8,
      fields: 'product_name,generic_name,categories_tags',
      lc: language,
    },
    timeout: 6000,
  })

  return data.products
    .map((p) => ({
      name: p.generic_name || p.product_name || '',
      category: extractCategory(p.categories_tags, language),
    }))
    .filter((p) => p.name.length > 0)
}
