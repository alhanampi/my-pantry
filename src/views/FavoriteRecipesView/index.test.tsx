import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FavoriteRecipesView from './index'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteRecipes, useFavoriteToggle } from '../../hooks/useFavorites'
import '../../i18n'
import type { RecipeCard, RecipeDetail } from '../../utils/types'

vi.mock('../../hooks/useRecipes')
vi.mock('../../hooks/useFavorites')

const recipe: RecipeCard = {
  id: 1,
  title: 'Pasta al pomodoro',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 25,
  ingredientNames: ['Pasta'],
  calories: 400,
}

const detail: RecipeDetail = {
  id: 1,
  title: 'Pasta al pomodoro',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 25,
  ingredients: [{ id: 10, name: 'Pasta', amount: 200, unit: 'g', original: '200g pasta' }],
  instructions: ['Boil water.'],
  nutrition: { calories: 400, protein: 20, carbs: 60, fat: 10 },
}

function mutationSpy() {
  return { mutate: vi.fn(), isPending: false } as never
}

describe('FavoriteRecipesView', () => {
  beforeEach(() => {
    vi.mocked(useFavoriteIds).mockReturnValue({ data: [1] } as never)
    vi.mocked(useFavoriteToggle).mockReturnValue({
      requestToggle: vi.fn(),
      confirmRemove: vi.fn(),
      cancelRemove: vi.fn(),
      pendingRemoveId: null,
      isPending: false,
    })
    vi.mocked(useRecipeDetail).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)
  })

  it('shows the empty state when there are no favorites', () => {
    vi.mocked(useFavoriteRecipes).mockReturnValue({ data: [], isLoading: false, isError: false } as never)

    render(<FavoriteRecipesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText(/no favorite recipes yet/i)).toBeInTheDocument()
  })

  it('shows the grid, then switches to the detail panel when a favorite is selected', async () => {
    vi.mocked(useFavoriteRecipes).mockReturnValue({ data: [recipe], isLoading: false, isError: false } as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: detail, isLoading: false, isError: false } as never)

    render(<FavoriteRecipesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Pasta al pomodoro'))

    expect(screen.getByText('Boil water.')).toBeInTheDocument()
    // Back to the grid.
    await userEvent.click(screen.getByLabelText('Back to recipes'))
    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()
  })
})
