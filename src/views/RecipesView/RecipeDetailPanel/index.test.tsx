import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeDetailPanel from './index'
import '../../../i18n'
import type { RecipeDetail } from '../../../utils/types'

const recipe: RecipeDetail = {
  id: 1,
  title: 'Pasta al pomodoro',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 25,
  ingredients: [{ id: 10, name: 'Pasta', amount: 200, unit: 'g', original: '200g pasta' }],
  instructions: ['Boil water.', 'Cook pasta.'],
  nutrition: { calories: 400, protein: 20, carbs: 60, fat: 10 },
}

describe('RecipeDetailPanel', () => {
  it('renders the title, ingredients and instructions', () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)
    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()
    expect(screen.getByText(/200 g Pasta/)).toBeInTheDocument()
    expect(screen.getByText('Boil water.')).toBeInTheDocument()
  })

  it('scales ingredient amounts and nutrition when servings change', async () => {
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('increase quantity')) // 2 -> 3 servings

    // 200g * (3/2) = 300g
    expect(screen.getByText(/300 g Pasta/)).toBeInTheDocument()
    // calories 400 * 1.5 = 600
    expect(screen.getByText('600')).toBeInTheDocument()
  })

  it('sends the scaled ingredients (not the originals) to the shopping list', async () => {
    const onSendToShoppingList = vi.fn()
    render(<RecipeDetailPanel recipe={recipe} onSendToShoppingList={onSendToShoppingList} />)

    await userEvent.click(screen.getByLabelText('increase quantity')) // 3 servings
    await userEvent.click(screen.getByText(/send to a new shopping list/i))

    expect(onSendToShoppingList).toHaveBeenCalledWith({
      recipeTitle: 'Pasta al pomodoro',
      ingredients: [{ id: 10, name: 'Pasta', amount: 300, unit: 'g', original: '200g pasta' }],
    })
  })
})
