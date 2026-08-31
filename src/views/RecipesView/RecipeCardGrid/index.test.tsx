import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeCardGrid from './index'
import '../../../i18n'
import type { RecipeCard } from '../../../utils/types'

const recipes: RecipeCard[] = [
  { id: 1, title: 'Pasta', image: 'a.jpg', servings: 2, readyInMinutes: 20, ingredientNames: [], calories: 300 },
  { id: 2, title: 'Salad', image: 'b.jpg', servings: 1, readyInMinutes: 10, ingredientNames: [], calories: 150 },
]

let observe: ReturnType<typeof vi.fn>
let disconnect: ReturnType<typeof vi.fn>

beforeEach(() => {
  observe = vi.fn()
  disconnect = vi.fn()
  // jsdom doesn't implement IntersectionObserver — stub it so the sentinel
  // effect can run without crashing.
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn().mockImplementation(function IntersectionObserverStub() {
      return { observe, disconnect, unobserve: vi.fn() }
    }),
  )
})

describe('RecipeCardGrid', () => {
  it('renders one RecipeCard per recipe and forwards onSelect', async () => {
    const onSelect = vi.fn()
    render(
      <RecipeCardGrid
        recipes={recipes}
        onSelect={onSelect}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={vi.fn()}
      />,
    )
    expect(screen.getByText('Pasta')).toBeInTheDocument()
    expect(screen.getByText('Salad')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Pasta'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('observes the sentinel only when there is a next page, and disconnects on unmount', () => {
    const { unmount } = render(
      <RecipeCardGrid
        recipes={recipes}
        onSelect={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        onLoadMore={vi.fn()}
      />,
    )
    expect(observe).toHaveBeenCalledTimes(1)
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not observe the sentinel when there is no next page', () => {
    render(
      <RecipeCardGrid
        recipes={recipes}
        onSelect={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={vi.fn()}
      />,
    )
    expect(observe).not.toHaveBeenCalled()
  })
})
