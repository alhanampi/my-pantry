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

  it('does not render a favorite button when onToggleFavorite is omitted', () => {
    render(<RecipeCard recipe={recipe} onClick={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /favorite|favorita/i })).not.toBeInTheDocument()
  })

  it('calls onToggleFavorite without triggering onClick when the heart is clicked', async () => {
    const onClick = vi.fn()
    const onToggleFavorite = vi.fn()
    render(<RecipeCard recipe={recipe} onClick={onClick} isFavorite={false} onToggleFavorite={onToggleFavorite} />)

    await userEvent.click(screen.getByRole('button', { pressed: false }))

    expect(onToggleFavorite).toHaveBeenCalledWith(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows the filled heart state when isFavorite is true', () => {
    render(<RecipeCard recipe={recipe} onClick={vi.fn()} isFavorite onToggleFavorite={vi.fn()} />)
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument()
  })
})
