import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeCard from './index'
import '../../../i18n'
import type { RecipeCard as RecipeCardType } from '../../../utils/types'

const recipe: RecipeCardType = {
  id: 1,
  title: 'Pasta al pomodoro',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 25,
  ingredientNames: ['Pasta', 'Tomato', 'Basil'],
  calories: 400,
}

describe('RecipeCard', () => {
  it('renders the recipe title and calls onClick with its id', async () => {
    const onClick = vi.fn()
    render(<RecipeCard recipe={recipe} onClick={onClick} />)
    expect(screen.getByText('Pasta al pomodoro')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Pasta al pomodoro'))
    expect(onClick).toHaveBeenCalledWith(1)
  })
})
