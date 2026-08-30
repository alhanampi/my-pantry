import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useProductSuggestions } from './useProductSuggestions'
import { fetchProductSuggestions } from '../api/productSuggestionsApi'
import { createTestQueryClient } from '../test/test-utils'

vi.mock('../api/productSuggestionsApi')

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = createTestQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useProductSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch below the minimum query length', () => {
    renderHook(() => useProductSuggestions('a', 'en'), { wrapper })
    expect(fetchProductSuggestions).not.toHaveBeenCalled()
  })

  it('returns placeholder data before the fetch resolves', () => {
    vi.mocked(fetchProductSuggestions).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useProductSuggestions('milk', 'en'), { wrapper })
    expect(result.current.data).toEqual([])
  })

  it('fetches once the query reaches the minimum length', async () => {
    vi.mocked(fetchProductSuggestions).mockResolvedValue([{ name: 'Milk', category: 'dairy' }])

    const { result } = renderHook(() => useProductSuggestions('mi', 'en'), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual([{ name: 'Milk', category: 'dairy' }]))
    expect(fetchProductSuggestions).toHaveBeenCalledWith('mi', 'en')
  })
})
