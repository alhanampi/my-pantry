import { describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import { fetchProductSuggestions } from './productSuggestionsApi'

vi.mock('axios')

describe('productSuggestionsApi (fetchProductSuggestions)', () => {
  it('maps OpenFoodFacts products to suggestions, preferring generic_name and the requested language category', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        products: [
          { generic_name: 'Leche entera', product_name: 'La Serenísima', categories_tags: ['es:lacteos', 'en:dairy'] },
          { product_name: 'Yerba mate', categories_tags: ['en:mate'] },
        ],
      },
    })

    const result = await fetchProductSuggestions('le', 'es')

    expect(result).toEqual([
      { name: 'Leche entera', category: 'lacteos' },
      { name: 'Yerba mate', category: 'mate' },
    ])
    expect(axios.get).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v2/search',
      expect.objectContaining({ params: expect.objectContaining({ search_terms: 'le', lc: 'es' }) })
    )
  })

  it('filters out products with no usable name', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { products: [{ categories_tags: [] }] },
    })

    const result = await fetchProductSuggestions('x', 'en')
    expect(result).toEqual([])
  })

  it('falls back to the last category tag when neither the requested language nor english is present', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { products: [{ product_name: 'Cosa', categories_tags: ['fr:chose'] }] },
    })

    const result = await fetchProductSuggestions('c', 'es')
    expect(result).toEqual([{ name: 'Cosa', category: 'chose' }])
  })
})
