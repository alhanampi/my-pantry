import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IngredientPicker from './index'
import { useFavoriteIngredients, useToggleFavoriteIngredient } from '../../hooks/useFavoriteIngredients'
import '../../i18n'

vi.mock('../../hooks/useFavoriteIngredients')

function renderPicker(props: Partial<Parameters<typeof IngredientPicker>[0]> = {}) {
  return render(
    <IngredientPicker selected={[]} onChange={vi.fn()} pantryItemNames={['tomate']} {...props} />,
  )
}

describe('IngredientPicker', () => {
  const toggleMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFavoriteIngredients).mockReturnValue({ data: [] } as never)
    vi.mocked(useToggleFavoriteIngredient).mockReturnValue({ mutate: toggleMutate, isPending: false } as never)
  })

  it('favorites a pantry ingredient from its own chip, without selecting it', async () => {
    const onChange = vi.fn()
    renderPicker({ onChange })

    const chip = screen.getByText('tomate').closest('.MuiChip-root') as HTMLElement
    const heart = chip.querySelector('.MuiChip-deleteIcon') as Element

    await userEvent.click(heart)

    expect(toggleMutate).toHaveBeenCalledWith({ name: 'tomate', isFavorite: false })
    // The heart click must not also toggle selection (separate action).
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a favorited ingredient in its own section with a filled heart', () => {
    vi.mocked(useFavoriteIngredients).mockReturnValue({ data: ['palta'] } as never)

    renderPicker()

    expect(screen.getByText('palta')).toBeInTheDocument()
  })
})
