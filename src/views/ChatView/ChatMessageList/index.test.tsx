import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatMessageList from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { ChatMessageItem, RecipeCard } from '../../../utils/types'

const msg = (overrides: Partial<ChatMessageItem> = {}): ChatMessageItem => ({
  id: '1',
  role: 'assistant',
  content: '',
  createdAt: '',
  ...overrides,
})

const recipe = (overrides: Partial<RecipeCard> = {}): RecipeCard => ({
  id: 1,
  title: 'Arroz con pollo',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 20,
  ingredientNames: [],
  calories: 300,
  ...overrides,
})

describe('ChatMessageList', () => {
  it('renders user text as plain text, not reinterpreted as markdown', () => {
    render(
      <ChatMessageList
        messages={[msg({ id: 'u1', role: 'user', content: '**not bold**' })]}
        suggestionEvents={[]}
        onSelectRecipe={vi.fn()}
      />,
    )
    expect(screen.getByText('**not bold**')).toBeInTheDocument()
  })

  it('renders assistant text as markdown', () => {
    render(
      <ChatMessageList
        messages={[msg({ id: 'a1', role: 'assistant', content: '**bold** text' })]}
        suggestionEvents={[]}
        onSelectRecipe={vi.fn()}
      />,
    )
    const bold = screen.getByText('bold')
    expect(bold.tagName).toBe('STRONG')
  })

  it('strips a raw HTML tag out of the assistant markdown instead of rendering it live', () => {
    render(
      <ChatMessageList
        messages={[msg({ id: 'a2', role: 'assistant', content: '<img src=x onerror=alert(1)>hi' })]}
        suggestionEvents={[]}
        onSelectRecipe={vi.fn()}
      />,
    )
    expect(document.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText(/hi/)).toBeInTheDocument()
  })

  it('renders a suggestion event between the messages that came before and after it', () => {
    render(
      <ChatMessageList
        messages={[
          msg({ id: 'm1', role: 'user', content: 'first' }),
          msg({ id: 'm2', role: 'assistant', content: 'second' }),
          msg({ id: 'm3', role: 'user', content: 'third, after the recipes' }),
        ]}
        suggestionEvents={[{ id: 's1', afterIndex: 2, recipes: [recipe()] }]}
        onSelectRecipe={vi.fn()}
      />,
    )

    const second = screen.getByText('second')
    const card = screen.getByText('Arroz con pollo')
    const third = screen.getByText('third, after the recipes')

    // 'second' (the last message before the event) precedes the recipe
    // card, which in turn precedes 'third' (sent afterward) — DOM order
    // mirrors conversation order instead of the card always trailing at
    // the very end regardless of when it was requested.
    expect(second.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders a warm intro line alongside a non-empty suggestion event', () => {
    render(
      <ChatMessageList
        messages={[msg({ id: 'm1', role: 'user', content: 'hola' })]}
        suggestionEvents={[{ id: 's1', afterIndex: 1, recipes: [recipe()] }]}
        onSelectRecipe={vi.fn()}
      />,
    )
    expect(screen.getByText(i18n.t('chat.suggestionsIntro'))).toBeInTheDocument()
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
  })

  it('renders the "no suggestions" text inline for an empty-recipes event, not a card', () => {
    render(
      <ChatMessageList
        messages={[msg({ id: 'm1', role: 'user', content: 'hola' })]}
        suggestionEvents={[{ id: 's1', afterIndex: 1, recipes: [] }]}
        onSelectRecipe={vi.fn()}
      />,
    )
    expect(screen.getByText(i18n.t('chat.noSuggestions'))).toBeInTheDocument()
  })

  it('passes favorite state through to a rendered suggestion card', async () => {
    const onToggleFavorite = vi.fn()
    render(
      <ChatMessageList
        messages={[]}
        suggestionEvents={[{ id: 's1', afterIndex: 0, recipes: [recipe()] }]}
        onSelectRecipe={vi.fn()}
        favoriteIds={new Set([1])}
        onToggleFavorite={onToggleFavorite}
      />,
    )
    const favoriteButton = screen.getByLabelText(i18n.t('recipes.removeFavorite'))
    await userEvent.click(favoriteButton)
    expect(onToggleFavorite).toHaveBeenCalledWith(1)
  })
})
