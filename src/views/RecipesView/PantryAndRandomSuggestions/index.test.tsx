import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantryAndRandomSuggestions from './index'
import { usePantryChatSuggestions } from '../../../hooks/useChat'
import { useRandomRecipeSuggestions } from '../../../hooks/useRecipes'
import '../../../i18n'
import type { RecipeCard } from '../../../utils/types'

vi.mock('../../../hooks/useChat')
vi.mock('../../../hooks/useRecipes')

function recipeCard(overrides: Partial<RecipeCard>): RecipeCard {
  return {
    id: 'spoonacular:1',
    source: 'spoonacular',
    title: 'Arroz con pollo',
    image: 'img.jpg',
    servings: 2,
    readyInMinutes: 25,
    ingredientNames: ['Arroz'],
    calories: 400,
    ...overrides,
  }
}

describe('PantryAndRandomSuggestions', () => {
  it('shows pantry-based and random suggestions in two separate sections', () => {
    vi.mocked(usePantryChatSuggestions).mockReturnValue({
      data: [recipeCard({ id: 'spoonacular:1', title: 'Arroz con pollo' })],
      isLoading: false,
    } as never)
    vi.mocked(useRandomRecipeSuggestions).mockReturnValue({
      data: { results: [recipeCard({ id: 'spoonacular:2', title: 'Milanesa' })], totalResults: 1, offset: 0, number: 4 },
      isLoading: false,
      isFetching: false,
      loadMore: vi.fn(),
    } as never)

    render(
      <PantryAndRandomSuggestions
        onSelectRecipe={vi.fn()}
        favoriteIds={new Set()}
        onToggleFavorite={vi.fn()}
      />,
    )

    expect(screen.getByText(/based on what's in your pantry/i)).toBeInTheDocument()
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
    expect(screen.getByText(/or try these options/i)).toBeInTheDocument()
    expect(screen.getByText('Milanesa')).toBeInTheDocument()
  })

  it('shows an empty hint instead of cards when there are no pantry-based suggestions', () => {
    vi.mocked(usePantryChatSuggestions).mockReturnValue({ data: [], isLoading: false } as never)
    vi.mocked(useRandomRecipeSuggestions).mockReturnValue({
      data: { results: [], totalResults: 0, offset: 0, number: 4 },
      isLoading: false,
      isFetching: false,
      loadMore: vi.fn(),
    } as never)

    render(
      <PantryAndRandomSuggestions
        onSelectRecipe={vi.fn()}
        favoriteIds={new Set()}
        onToggleFavorite={vi.fn()}
      />,
    )

    expect(screen.getByText(/add items to your pantry/i)).toBeInTheDocument()
  })

  it('calls loadMore only for the random section when "More suggestions" is clicked', async () => {
    const loadMore = vi.fn()
    vi.mocked(usePantryChatSuggestions).mockReturnValue({
      data: [recipeCard({ id: 'spoonacular:1' })],
      isLoading: false,
    } as never)
    vi.mocked(useRandomRecipeSuggestions).mockReturnValue({
      data: { results: [recipeCard({ id: 'spoonacular:2', title: 'Milanesa' })], totalResults: 1, offset: 0, number: 4 },
      isLoading: false,
      isFetching: false,
      loadMore,
    } as never)

    render(
      <PantryAndRandomSuggestions
        onSelectRecipe={vi.fn()}
        favoriteIds={new Set()}
        onToggleFavorite={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText(/more suggestions/i))
    expect(loadMore).toHaveBeenCalledTimes(1)
  })
})
