import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipesView from './index'
import { useRecipeSearch, useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteToggle } from '../../hooks/useFavorites'
import '../../i18n'
import type { RecipeCard, RecipeDetail } from '../../utils/types'

vi.mock('../../hooks/useRecipes')
vi.mock('../../hooks/useFavorites')
vi.mock('../../hooks/useUnitSystem', () => ({
  useUnitSystem: () => ({ unitSystem: 'metric', setUnitSystem: vi.fn(), isPending: false }),
}))

vi.mock('./RecipeCardGrid', () => ({
  // Stubbed out — RecipeCardGrid's own IntersectionObserver behavior is
  // covered by its own test; here we just need a clickable card.
  default: ({ recipes, onSelect }: { recipes: RecipeCard[]; onSelect: (id: number) => void }) => (
    <div>
      {recipes.map((r) => (
        <button key={r.id} onClick={() => onSelect(r.id)}>
          {r.title}
        </button>
      ))}
    </div>
  ),
}))

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

describe('RecipesView', () => {
  beforeEach(() => {
    vi.mocked(useFavoriteIds).mockReturnValue({ data: [] } as never)
    vi.mocked(useFavoriteToggle).mockReturnValue({
      requestToggle: vi.fn(),
      confirmRemove: vi.fn(),
      cancelRemove: vi.fn(),
      pendingRemoveId: null,
      isPending: false,
      pendingRecipeId: undefined,
    })
  })

  it('shows the grid, then switches to the detail panel when a recipe is selected', async () => {
    vi.mocked(useRecipeSearch).mockReturnValue({
      data: { pages: [{ results: [recipe], totalResults: 1, offset: 0, number: 4 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    } as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: detail, isLoading: false, isError: false } as never)

    render(<RecipesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Pasta al pomodoro'))

    expect(screen.getByText('Boil water.')).toBeInTheDocument()
  })

  it('shows the empty state when the search returns no results', () => {
    vi.mocked(useRecipeSearch).mockReturnValue({
      data: { pages: [{ results: [], totalResults: 0, offset: 0, number: 4 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    } as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)

    render(<RecipesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText(/no recipes found/i)).toBeInTheDocument()
  })

  it('shows the remove-favorite confirm dialog when useFavoriteToggle reports a pending removal', () => {
    vi.mocked(useRecipeSearch).mockReturnValue({
      data: { pages: [{ results: [recipe], totalResults: 1, offset: 0, number: 4 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    } as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)
    vi.mocked(useFavoriteToggle).mockReturnValue({
      requestToggle: vi.fn(),
      confirmRemove: vi.fn(),
      cancelRemove: vi.fn(),
      pendingRemoveId: 1,
      isPending: false,
      pendingRecipeId: undefined,
    })

    render(<RecipesView sendRecipeToShoppingList={mutationSpy()} onSentToList={vi.fn()} />)

    expect(screen.getByText(/remove from favorites\?/i)).toBeInTheDocument()
  })
})
