import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatSuggestionCards from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { RecipeCard } from '../../../utils/types'

const recipe: RecipeCard = {
  id: 1,
  title: 'Arroz con pollo',
  image: 'img.jpg',
  servings: 2,
  readyInMinutes: 30,
  ingredientNames: ['Arroz', 'Pollo'],
  calories: 400,
}

describe('ChatSuggestionCards', () => {
  it('renders a card per suggested recipe and calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    render(<ChatSuggestionCards recipes={[recipe]} onSelect={onSelect} />)

    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Arroz con pollo'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('passes favorite state through to the card and calls onToggleFavorite', async () => {
    const onToggleFavorite = vi.fn()
    render(
      <ChatSuggestionCards
        recipes={[recipe]}
        onSelect={vi.fn()}
        favoriteIds={new Set([1])}
        onToggleFavorite={onToggleFavorite}
      />,
    )

    const favoriteButton = screen.getByLabelText(i18n.t('recipes.removeFavorite'))
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(favoriteButton)
    expect(onToggleFavorite).toHaveBeenCalledWith(1)
  })
})
