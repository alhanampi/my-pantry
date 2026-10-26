import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useChatSession } from './useChatSession'
import { streamChatMessage, apiSuggestIngredients } from '../api/chatApi'

vi.mock('../api/chatApi')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useChatSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue('token-123') })
  })

  it('adds optimistic user + assistant bubbles and streams tokens into the placeholder', async () => {
    vi.mocked(streamChatMessage).mockImplementation(async (_token, _id, _body, callbacks) => {
      callbacks.onToken('Hola')
      callbacks.onToken(' mundo')
      callbacks.onDone({ messageId: 'server-1' })
    })

    const { result } = renderHook(() => useChatSession('c1', []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('Tengo arroz')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Tengo arroz' })
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: 'Hola mundo', id: 'server-1' })
  })

  it('rolls back only the assistant placeholder on a stream error, keeping the user message', async () => {
    vi.mocked(streamChatMessage).mockImplementation(async (_token, _id, _body, callbacks) => {
      callbacks.onError('configError')
    })

    const { result } = renderHook(() => useChatSession('c1', []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('hola')
    })

    expect(result.current.streamError).toBe('configError')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'hola' })
  })

  it('does nothing when there is no active conversation', async () => {
    const { result } = renderHook(() => useChatSession(null, []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('hola')
    })

    expect(streamChatMessage).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('recovers from a network failure (fetch rejecting) instead of leaving isStreaming stuck true forever', async () => {
    vi.mocked(streamChatMessage).mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useChatSession('c1', []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('hola')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    expect(result.current.streamError).toBe('generic')
    // The optimistic user+placeholder pair is rolled back to just the user
    // message being retryable — no message stuck in a broken state.
    expect(result.current.messages.some((m) => m.role === 'assistant')).toBe(false)
  })

  it('fetches AI ingredient suggestions after a reply finishes, without delaying isStreaming', async () => {
    vi.mocked(streamChatMessage).mockImplementation(async (_token, _id, _body, callbacks) => {
      callbacks.onDone({ messageId: 'server-1' })
    })
    vi.mocked(apiSuggestIngredients).mockResolvedValue(['jengibre', 'ajo'])

    const { result } = renderHook(() => useChatSession('c1', []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('quiero comida china')
    })

    await waitFor(() => expect(result.current.ingredientSuggestions).toEqual(['jengibre', 'ajo']))
    const [token, conversationId] = vi.mocked(apiSuggestIngredients).mock.calls[0]
    expect(token).toBe('token-123')
    expect(conversationId).toBe('c1')
  })

  it('swallows a failed ingredient-suggestion fetch instead of surfacing it as a chat error', async () => {
    vi.mocked(streamChatMessage).mockImplementation(async (_token, _id, _body, callbacks) => {
      callbacks.onDone({ messageId: 'server-1' })
    })
    vi.mocked(apiSuggestIngredients).mockRejectedValue(new Error('down'))

    const { result } = renderHook(() => useChatSession('c1', []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('hola')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    expect(result.current.streamError).toBeNull()
    expect(result.current.ingredientSuggestions).toEqual([])
  })

  it('clears stale ingredient suggestions as soon as a new message is sent', async () => {
    vi.mocked(streamChatMessage).mockImplementation(async (_token, _id, _body, callbacks) => {
      callbacks.onDone({ messageId: 'server-1' })
    })
    vi.mocked(apiSuggestIngredients).mockResolvedValue(['jengibre'])

    const { result } = renderHook(() => useChatSession('c1', []), { wrapper })

    await act(async () => {
      await result.current.sendMessage('quiero comida china')
    })
    await waitFor(() => expect(result.current.ingredientSuggestions).toEqual(['jengibre']))

    vi.mocked(apiSuggestIngredients).mockReturnValue(new Promise(() => {})) // never resolves
    await act(async () => {
      await result.current.sendMessage('tengo jengibre tambien')
    })

    expect(result.current.ingredientSuggestions).toEqual([])
  })
})
