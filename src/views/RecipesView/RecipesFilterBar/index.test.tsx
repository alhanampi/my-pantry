import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipesFilterBar from './index'
import '../../../i18n'
import type { RecipeSearchFilters } from '../../../utils/types'

const filters: RecipeSearchFilters = { query: '', cuisine: '', diet: '', includeIngredients: '', maxCalories: '' }

describe('RecipesFilterBar', () => {
  it('calls onChange with the updated query as the user types', async () => {
    const onChange = vi.fn()
    render(<RecipesFilterBar filters={filters} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText(/search recipes/i), 'p')
    expect(onChange).toHaveBeenCalledWith({ ...filters, query: 'p' })
  })
})
