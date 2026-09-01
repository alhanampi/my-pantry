import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useConversations, useCreateConversation, useSuggestRecipe } from './useChat'
import * as chatApi from '../api/chatApi'
import '../i18n'

vi.mock('../api/chatApi')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useChat hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, getToken: vi.fn().mockResolvedValue('token-123') })
  })

  it('useConversations is disabled when signed out', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, getToken: vi.fn() })
    const { result } = renderHook(() => useConversations(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(chatApi.apiListConversations).not.toHaveBeenCalled()
  })

  it('useConversations fetches the caller\'s conversations when signed in', async () => {
    vi.mocked(chatApi.apiListConversations).mockResolvedValue([
      { id: 'c1', title: 'New chat', dietaryRestrictions: [], servings: 2, updatedAt: '' },
    ])
    const { result } = renderHook(() => useConversations(), { wrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
  })

  it('useCreateConversation posts dietaryRestrictions + servings', async () => {
    vi.mocked(chatApi.apiCreateConversation).mockResolvedValue({
      id: 'c1',
      title: 'New chat',
      dietaryRestrictions: ['vegan'],
      servings: 3,
      updatedAt: '',
    })
    const { result } = renderHook(() => useCreateConversation(), { wrapper })
    result.current.mutate({ dietaryRestrictions: ['vegan'], servings: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(chatApi.apiCreateConversation).toHaveBeenCalledWith('token-123', ['vegan'], 3)
  })

  it('useSuggestRecipe calls apiSuggestRecipe with the conversation id', async () => {
    vi.mocked(chatApi.apiSuggestRecipe).mockResolvedValue({ recipes: [] })
    const { result } = renderHook(() => useSuggestRecipe(), { wrapper })
    result.current.mutate('c1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(chatApi.apiSuggestRecipe).toHaveBeenCalledWith('token-123', 'c1', expect.any(String))
  })
})
