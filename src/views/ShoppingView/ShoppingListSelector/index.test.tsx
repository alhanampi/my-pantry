import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingListSelector from './index'
import '../../../i18n'
import type { ShoppingList } from '../../../utils/types'

const lists: ShoppingList[] = [
  { id: 'l1', name: 'General', ownerId: 'u1', isGeneral: true, createdAt: '' },
  { id: 'l2', name: 'Pasta al pomodoro', ownerId: 'u1', isGeneral: false, createdAt: '' },
]

describe('ShoppingListSelector', () => {
  it('renders nothing when there is only one list', () => {
    const { container } = render(
      <ShoppingListSelector lists={[lists[0]]} selectedListId="l1" onSelectList={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists all shopping lists and calls onSelectList when changed', async () => {
    const onSelectList = vi.fn()
    render(<ShoppingListSelector lists={lists} selectedListId="l1" onSelectList={onSelectList} />)

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByText('Pasta al pomodoro'))

    expect(onSelectList).toHaveBeenCalledWith('l2')
  })
})
