import es from './products.es.json'
import en from './products.en.json'
import type { ProductSuggestion } from '../utils/types'

const registry: Record<string, ProductSuggestion[]> = {
  es: es as ProductSuggestion[],
  en: en as ProductSuggestion[],
}

const FALLBACK = 'en'

export function getProductSuggestions(language: string): ProductSuggestion[] {
  return registry[language] ?? registry[FALLBACK]
}
