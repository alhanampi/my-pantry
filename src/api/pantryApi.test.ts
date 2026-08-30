import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiGetProducts, apiCreateProduct } from './pantryApi'
import type { ProductFormData } from '../utils/types'

describe('pantryApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('apiGetProducts returns the products from a successful response', async () => {
    const apiProduct = { id: 1, name: 'Leche', quantity: '1L', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ products: [apiProduct] }), { status: 200 })
    )

    const products = await apiGetProducts('token-123')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pantry/products'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) })
    )
    expect(products).toEqual([apiProduct])
  })

  it('apiCreateProduct sends a POST with the product data and returns the created product', async () => {
    const data: ProductFormData = {
      name: 'Arroz',
      quantity: '1kg',
      brand: '',
      purchaseDate: '',
      expiryDate: '',
      location: '',
      details: '',
    }
    const created = { id: 2, ...data }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ product: created }), { status: 201 })
    )

    const result = await apiCreateProduct('token-123', data)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pantry/products'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(data) })
    )
    expect(result).toEqual(created)
  })

  it('throws the server error message when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 })
    )

    await expect(apiGetProducts('token-123')).rejects.toThrow('Name is required')
  })

  it('falls back to a generic message when the error body cannot be parsed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 500 }))

    await expect(apiGetProducts('token-123')).rejects.toThrow('Server error')
  })
})
