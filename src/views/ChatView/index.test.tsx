import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatView from './index'
import { useConversations, useConversation, useCreateConversation, useDeleteConversation, useSuggestRecipe } from '../../hooks/useChat'
import { useChatSession } from '../../hooks/useChatSession'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteToggle } from '../../hooks/useFavorites'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useNearbyStores } from '../../hooks/useNearbyStores'
import { usePantry } from '../../hooks/usePantry'
import '../../i18n'
import i18n from '../../i18n'

vi.mock('../../hooks/useChat')
vi.mock('../../hooks/useChatSession')
vi.mock('../../hooks/useRecipes')
vi.mock('../../hooks/useFavorites')
vi.mock('../../hooks/useGeolocation')
vi.mock('../../hooks/useNearbyStores')
vi.mock('../../hooks/usePantry')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function mutationSpy(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, ...overrides }
}

function favoriteToggleSpy(overrides: Record<string, unknown> = {}) {
  return {
    requestToggle: vi.fn(),
    confirmRemove: vi.fn(),
    cancelRemove: vi.fn(),
    pendingRemoveId: null,
    isPending: false,
    ...overrides,
  }
}

function defaultSessionMock() {
  return {
    messages: [],
    resetMessages: vi.fn(),
    sendMessage: vi.fn(),
    isStreaming: false,
    streamError: null,
  }
}

const existingConversation = {
  id: 'c1',
  title: 'My conversation',
  dietaryRestrictions: [],
  servings: 2,
  updatedAt: '',
}

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
    vi.mocked(useConversations).mockReturnValue({ data: [], isSuccess: true } as never)
    vi.mocked(useConversation).mockReturnValue({ data: undefined } as never)
    vi.mocked(useCreateConversation).mockReturnValue(mutationSpy() as never)
    vi.mocked(useDeleteConversation).mockReturnValue(mutationSpy() as never)
    vi.mocked(useSuggestRecipe).mockReturnValue(mutationSpy({ data: undefined }) as never)
    vi.mocked(useChatSession).mockReturnValue(defaultSessionMock() as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)
    vi.mocked(useGeolocation).mockReturnValue({ coords: null, error: null, requestLocation: vi.fn() })
    vi.mocked(useNearbyStores).mockReturnValue({ data: undefined } as never)
    vi.mocked(usePantry).mockReturnValue({ products: [] } as never)
    vi.mocked(useFavoriteIds).mockReturnValue({ data: [] } as never)
    vi.mocked(useFavoriteToggle).mockReturnValue(favoriteToggleSpy() as never)
  })

  it('shows a signed-out prompt instead of the chat when not signed in', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true })
    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    expect(screen.getByText(i18n.t('chat.signedOutTitle'))).toBeInTheDocument()
  })

  it('shows onboarding automatically (no button click needed) when there are no conversations yet', () => {
    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    expect(screen.getByText(i18n.t('chat.onboardingTitle'))).toBeInTheDocument()
  })

  it('creates a conversation from the onboarding form (dietaryRestrictions/servings only, no initialQuery)', async () => {
    const createConversation = mutationSpy()
    vi.mocked(useCreateConversation).mockReturnValue(createConversation as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    expect(createConversation.mutate).toHaveBeenCalledWith(
      { dietaryRestrictions: [], servings: 2 },
      expect.anything(),
    )
  })

  it('sends the typed recipe/ingredient as the first message and auto-requests suggestions once the chat opens', async () => {
    const createConversation = mutationSpy({
      mutate: vi.fn((_payload, opts) => {
        opts.onSuccess({ id: 'new1', title: 'New chat', dietaryRestrictions: [], servings: 2, updatedAt: '' })
      }),
    })
    vi.mocked(useCreateConversation).mockReturnValue(createConversation as never)
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useChatSession).mockReturnValue({ ...defaultSessionMock(), sendMessage } as never)
    const suggestRecipe = mutationSpy({ data: undefined })
    vi.mocked(useSuggestRecipe).mockReturnValue(suggestRecipe as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(i18n.t('chat.onboardingQueryPlaceholder')), 'pollo')
    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('pollo', undefined))
    await waitFor(() => expect(suggestRecipe.mutate).toHaveBeenCalledWith('new1', expect.anything()))
  })

  it('still requests suggestions after onboarding even with an empty query (diet-only fallback)', async () => {
    const createConversation = mutationSpy({
      mutate: vi.fn((_payload, opts) => {
        opts.onSuccess({ id: 'new2', title: 'New chat', dietaryRestrictions: [], servings: 2, updatedAt: '' })
      }),
    })
    vi.mocked(useCreateConversation).mockReturnValue(createConversation as never)
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useChatSession).mockReturnValue({ ...defaultSessionMock(), sendMessage } as never)
    const suggestRecipe = mutationSpy({ data: undefined })
    vi.mocked(useSuggestRecipe).mockReturnValue(suggestRecipe as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    await waitFor(() => expect(suggestRecipe.mutate).toHaveBeenCalledWith('new2', expect.anything()))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('always shows the new-chat onboarding on entering the tab, even with existing conversations', () => {
    vi.mocked(useConversations).mockReturnValue({ data: [existingConversation], isSuccess: true } as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)

    expect(screen.getByText(i18n.t('chat.onboardingTitle'))).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(i18n.t('chat.placeholder'))).not.toBeInTheDocument()
  })

  function suggestRecipeSpyWithRecipes(recipes: unknown[]) {
    return mutationSpy({
      mutate: vi.fn((_id, opts) => opts?.onSuccess?.({ recipes })),
    })
  }

  it('shows the suggest-recipe button once there are enough messages, and renders suggestions inline after clicking it', async () => {
    vi.mocked(useConversations).mockReturnValue({ data: [existingConversation], isSuccess: true } as never)
    vi.mocked(useChatSession).mockReturnValue({
      ...defaultSessionMock(),
      messages: [
        { id: '1', role: 'user', content: 'tengo arroz', createdAt: '' },
        { id: '2', role: 'assistant', content: 'genial', createdAt: '' },
      ],
    } as never)
    vi.mocked(useSuggestRecipe).mockReturnValue(
      suggestRecipeSpyWithRecipes([
        { id: 1, title: 'Arroz con pollo', image: 'img.jpg', servings: 2, readyInMinutes: 20, ingredientNames: [], calories: 300 },
      ]) as never,
    )

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(i18n.t('chat.history')))
    await userEvent.click(screen.getByText(existingConversation.title))

    expect(screen.getByText(i18n.t('chat.suggestRecipe'))).toBeInTheDocument()
    expect(screen.queryByText('Arroz con pollo')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText(i18n.t('chat.suggestRecipe')))
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
  })

  it('lets a suggested recipe be favorited from the chat', async () => {
    vi.mocked(useConversations).mockReturnValue({ data: [existingConversation], isSuccess: true } as never)
    vi.mocked(useChatSession).mockReturnValue({
      ...defaultSessionMock(),
      messages: [
        { id: '1', role: 'user', content: 'tengo arroz', createdAt: '' },
        { id: '2', role: 'assistant', content: 'genial', createdAt: '' },
      ],
    } as never)
    vi.mocked(useSuggestRecipe).mockReturnValue(
      suggestRecipeSpyWithRecipes([
        { id: 1, title: 'Arroz con pollo', image: 'img.jpg', servings: 2, readyInMinutes: 20, ingredientNames: [], calories: 300 },
      ]) as never,
    )
    const favoriteToggle = favoriteToggleSpy()
    vi.mocked(useFavoriteToggle).mockReturnValue(favoriteToggle as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(i18n.t('chat.history')))
    await userEvent.click(screen.getByText(existingConversation.title))
    await userEvent.click(screen.getByText(i18n.t('chat.suggestRecipe')))

    await userEvent.click(screen.getByLabelText(i18n.t('recipes.addFavorite')))
    expect(favoriteToggle.requestToggle).toHaveBeenCalledWith(1, false)
  })

  it('hides the quick-reply chips once a recipe has already been suggested', async () => {
    vi.mocked(useConversations).mockReturnValue({ data: [existingConversation], isSuccess: true } as never)
    vi.mocked(useChatSession).mockReturnValue({
      ...defaultSessionMock(),
      messages: [
        { id: '1', role: 'user', content: 'tengo arroz', createdAt: '' },
        { id: '2', role: 'assistant', content: 'genial', createdAt: '' },
      ],
    } as never)
    vi.mocked(useSuggestRecipe).mockReturnValue(
      suggestRecipeSpyWithRecipes([
        { id: 1, title: 'Arroz con pollo', image: 'img.jpg', servings: 2, readyInMinutes: 20, ingredientNames: [], calories: 300 },
      ]) as never,
    )

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(i18n.t('chat.history')))
    await userEvent.click(screen.getByText(existingConversation.title))

    expect(screen.getByText(i18n.t('chat.quickReplies.time10Label'))).toBeInTheDocument()

    await userEvent.click(screen.getByText(i18n.t('chat.suggestRecipe')))

    expect(screen.queryByText(i18n.t('chat.quickReplies.time10Label'))).not.toBeInTheDocument()
  })

  it('only offers pantry-ingredient chips that are actually mentioned in the conversation so far', async () => {
    vi.mocked(useConversations).mockReturnValue({ data: [existingConversation], isSuccess: true } as never)
    vi.mocked(useChatSession).mockReturnValue({
      ...defaultSessionMock(),
      messages: [{ id: '1', role: 'user', content: 'Tengo queso fresco a mano', createdAt: '' }],
    } as never)
    vi.mocked(usePantry).mockReturnValue({
      products: [{ id: 1, name: 'Queso fresco' }, { id: 2, name: 'Lentejas' }],
    } as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(i18n.t('chat.history')))
    await userEvent.click(screen.getByText(existingConversation.title))

    expect(screen.getByText('Queso fresco')).toBeInTheDocument()
    expect(screen.queryByText('Lentejas')).not.toBeInTheDocument()
  })

  it('opens the history drawer and shows the delete-conversation confirm dialog from it', async () => {
    vi.mocked(useConversations).mockReturnValue({ data: [existingConversation], isSuccess: true } as never)
    const deleteConversation = mutationSpy()
    vi.mocked(useDeleteConversation).mockReturnValue(deleteConversation as never)

    render(<ChatView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} />)

    await userEvent.click(screen.getByLabelText(i18n.t('chat.history')))
    await userEvent.click(screen.getByLabelText(i18n.t('chat.deleteChat')))
    expect(screen.getByText(i18n.t('chat.deleteChatConfirmTitle'))).toBeInTheDocument()

    await userEvent.click(screen.getByText(i18n.t('chat.deleteChat')))
    expect(deleteConversation.mutate).toHaveBeenCalledWith('c1', expect.anything())
  })
})
