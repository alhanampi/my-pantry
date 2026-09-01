import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeDetailPanel from './index'
import '../../../i18n'
import type { RecipeDetail } from '../../../utils/types'

const mockSetUnitSystem = vi.fn()
const mockUseUnitSystem = vi.fn(
  (): { unitSystem: 'metric' | 'imperial'; setUnitSystem: typeof mockSetUnitSystem; isPending: boolean } => ({
    unitSystem: 'metric',
    setUnitSystem: mockSetUnitSystem,
    isPending: false,
  }),
)
vi.mock('../../../hooks/useUnitSystem', () => ({
  useUnitSystem: () => mockUseUnitSystem(),
}))

const recipe: RecipeDetail = {
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
  instructions: ['Boil water.', 'Cook pasta.'],
  nutrition: {
    calories: 400,
    protein: 20,
    carbs: 60,
    fat: 10,
    caloriesPercent: 20,
    proteinPercent: 40,
    carbsPercent: 25,
    fatPercent: 15,
  },
}

describe('RecipeDetailPanel', () => {
  it('renders the title, ingredients and instructions', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()
    expect(screen.getByText(/200 g Pasta/)).toBeInTheDocument()
    expect(screen.getByText('Boil water.')).toBeInTheDocument()
  })

  it('renders each instruction step with its number (1-indexed)', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    const first = screen.getByText('Boil water.')
    const second = screen.getByText('Cook pasta.')
    // Step 1's circle ("1") is unambiguous; step 2's own circle would
    // collide with the servings stepper's default "2" count, so instead
    // confirm DOM order — each step's circle immediately precedes its text.
    expect(screen.getByText('1').compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders a nutrition bar per macro with its % of daily needs', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    expect(screen.getByText(/400 kcal/)).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument() // calories
    expect(screen.getByText('40%')).toBeInTheDocument() // protein
    expect(screen.getByText('15%')).toBeInTheDocument() // fat
  })

  it('scales ingredient amounts and nutrition when servings change', async () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('increase quantity')) // 2 -> 3 servings

    // 200g * (3/2) = 300g
    expect(screen.getByText(/300 g Pasta/)).toBeInTheDocument()
    // calories 400 * 1.5 = 600
    expect(screen.getByText(/600 kcal/)).toBeInTheDocument()
    // caloriesPercent 20 * 1.5 = 30
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('sends the scaled ingredients (not the originals) to the shopping list', async () => {
    const onSendToShoppingList = vi.fn()
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={onSendToShoppingList} />)

    await userEvent.click(screen.getByLabelText('increase quantity')) // 3 servings
    await userEvent.click(screen.getByText(/send to a new shopping list/i))

    expect(onSendToShoppingList).toHaveBeenCalledWith({
      recipeTitle: 'Pasta al pomodoro',
      ingredients: [
        {
          id: 10,
          name: 'Pasta',
          amount: 300,
          unit: 'g',
          original: '200g pasta',
          measures: { metric: { amount: 200, unit: 'g' }, us: { amount: 7, unit: 'oz' } },
        },
      ],
    })
  })

  it('does not render a "view full recipe" link even when sourceUrl is present (no navigating out of the app)', () => {
    render(<RecipeDetailPanel recipe={{ ...recipe, sourceUrl: 'https://example.com/pasta' }} onSendToShoppingList={vi.fn()} />)
    expect(screen.queryByText(/view full recipe/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('defaults servings from initialServings when provided', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} initialServings={4} />)
    // 200g * (4/2) = 400g
    expect(screen.getByText(/400 g Pasta/)).toBeInTheDocument()
  })

  it('does not render a favorite button when onToggleFavorite is omitted', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /favorite|favorita/i })).not.toBeInTheDocument()
  })

  it('calls onToggleFavorite with the recipe id when the heart is clicked', async () => {
    const onToggleFavorite = vi.fn()
    render(
      <RecipeDetailPanel
        recipe={recipe}
        onSendToShoppingList={vi.fn()}
        isFavorite={false}
        onToggleFavorite={onToggleFavorite}
      />,
    )
    await userEvent.click(screen.getByRole('button', { pressed: false }))
    expect(onToggleFavorite).toHaveBeenCalledWith(1)
  })

  it('shows a spinner and disables the favorite button while isTogglingFavorite is true', () => {
    render(
      <RecipeDetailPanel
        recipe={recipe}
        onSendToShoppingList={vi.fn()}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        isTogglingFavorite
      />,
    )
    expect(screen.getByRole('button', { pressed: false })).toBeDisabled()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows a spinner on the send-to-shopping-list button while isSending is true', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} isSending />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the us measure (and scales it) when the unit system is imperial', () => {
    mockUseUnitSystem.mockReturnValueOnce({ unitSystem: 'imperial', setUnitSystem: mockSetUnitSystem, isPending: false })
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    expect(screen.getByText(/7 oz Pasta/)).toBeInTheDocument()
  })

  it('clicking the unit-system toggle calls setUnitSystem with the other system', async () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(mockSetUnitSystem).toHaveBeenCalledWith('imperial')
  })

  it('shows a fallback message instead of an empty list when the recipe has no instructions', () => {
    render(<RecipeDetailPanel recipe={{ ...recipe, instructions: [] }} onSendToShoppingList={vi.fn()} />)
    expect(
      screen.getByText(/doesn't include step-by-step instructions/i),
    ).toBeInTheDocument()
  })

  it('renders 0%, not "NaN%", when a *Percent field is missing on stale/cached data', () => {
    const staleRecipe = {
      ...recipe,
      nutrition: { ...recipe.nutrition, caloriesPercent: undefined as unknown as number },
    }
    render(<RecipeDetailPanel recipe={staleRecipe} onSendToShoppingList={vi.fn()} />)
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders the nutrition section after the instructions section', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    const instructions = screen.getByText('Boil water.')
    const nutrition = screen.getByText(/400 kcal/)
    expect(instructions.compareDocumentPosition(nutrition) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
