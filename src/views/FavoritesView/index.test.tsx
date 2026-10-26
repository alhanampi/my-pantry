import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FavoritesView from './index'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteRecipes, useFavoriteToggle } from '../../hooks/useFavorites'
import { useFavoriteIngredients, useToggleFavoriteIngredient } from '../../hooks/useFavoriteIngredients'
import { useFavoriteStores } from '../../hooks/useFavoriteStores'
import { useFavoriteShoppingLists } from '../../hooks/useFavoriteShoppingLists'
import '../../i18n'
import type { RecipeCard, RecipeDetail } from '../../utils/types'

vi.mock('../../hooks/useRecipes')
vi.mock('../../hooks/useFavorites')
vi.mock('../../hooks/useFavoriteIngredients')
vi.mock('../../hooks/useFavoriteStores')
vi.mock('../../hooks/useFavoriteShoppingLists')
vi.mock('../../hooks/useUnitSystem', () => ({
  useUnitSystem: () => ({ unitSystem: 'metric', setUnitSystem: vi.fn(), isPending: false }),
}))

const recipe: RecipeCard = {
  id: 'spoonacular:1',
  source: 'spoonacular',
  title: 'Pasta al pomodoro',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 25,
  ingredientNames: ['Pasta'],
  calories: 400,
}

const detail: RecipeDetail = {
  id: 'spoonacular:1',
  source: 'spoonacular',
  title: 'Pasta al pomodoro',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 25,
  ingredients: [
    {
      id: 10,
      name: 'Pasta',
      amount: 200,
      unit: 'g',
      original: '200g pasta',
      measures: { metric: { amount: 200, unit: 'g' }, us: { amount: 7, unit: 'oz' } },
    },
  ],
  instructions: ['Boil water.'],
  nutrition: {
    calories: 400,
    protein: 20,
    carbs: 60,
    fat: 10,
    caloriesPercent: 20,
    proteinPercent: 40,
    carbsPercent: 20,
    fatPercent: 15,
  },
}

function mutationSpy() {
  return { mutate: vi.fn(), isPending: false } as never
}

describe('FavoritesView', () => {
  beforeEach(() => {
    vi.mocked(useFavoriteIds).mockReturnValue({ data: ['spoonacular:1'] } as never)
    vi.mocked(useFavoriteToggle).mockReturnValue({
      requestToggle: vi.fn(),
      confirmRemove: vi.fn(),
      cancelRemove: vi.fn(),
      pendingRemoveId: null,
      isPending: false,
      pendingRecipeId: undefined,
    })
    vi.mocked(useRecipeDetail).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)
    vi.mocked(useFavoriteIngredients).mockReturnValue({ data: [] } as never)
    vi.mocked(useToggleFavoriteIngredient).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as never)
    vi.mocked(useFavoriteStores).mockReturnValue({ data: [] } as never)
    vi.mocked(useFavoriteShoppingLists).mockReturnValue({ data: [] } as never)
  })

  it('shows the empty state for recipes and ingredients when there are none', () => {
    vi.mocked(useFavoriteRecipes).mockReturnValue({ data: [], isLoading: false, isError: false } as never)

    render(<FavoritesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText(/no favorite recipes yet/i)).toBeInTheDocument()
    expect(screen.getByText(/no favorite ingredients yet/i)).toBeInTheDocument()
    expect(screen.getByText(/no favorite stores yet/i)).toBeInTheDocument()
    expect(screen.getByText(/no favorite shopping lists yet/i)).toBeInTheDocument()
  })

  it('shows the recipes section, then switches to the detail panel when a favorite is selected', async () => {
    vi.mocked(useFavoriteRecipes).mockReturnValue({ data: [recipe], isLoading: false, isError: false } as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: detail, isLoading: false, isError: false } as never)

    render(<FavoritesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Pasta al pomodoro'))

    expect(screen.getByText('Boil water.')).toBeInTheDocument()
    // Back to the grid.
    await userEvent.click(screen.getByLabelText('Back to recipes'))
    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()
  })

  it('shows favorite ingredient chips in the ingredients section', () => {
    vi.mocked(useFavoriteRecipes).mockReturnValue({ data: [], isLoading: false, isError: false } as never)
    vi.mocked(useFavoriteIngredients).mockReturnValue({ data: ['palta', 'sin maní'] } as never)

    render(<FavoritesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText('palta')).toBeInTheDocument()
    expect(screen.getByText('sin maní')).toBeInTheDocument()
  })

  it('adds a new favorite ingredient from the input in the ingredients section', async () => {
    vi.mocked(useFavoriteRecipes).mockReturnValue({ data: [], isLoading: false, isError: false } as never)
    const toggleMutate = vi.fn()
    vi.mocked(useToggleFavoriteIngredient).mockReturnValue({
      mutate: toggleMutate,
      isPending: false,
      variables: undefined,
    } as never)

    render(<FavoritesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    const input = screen.getByPlaceholderText(/add favorite ingredient/i)
    await userEvent.type(input, 'ginger{enter}')

    expect(toggleMutate).toHaveBeenCalledWith({ name: 'ginger', isFavorite: false })
  })
})
