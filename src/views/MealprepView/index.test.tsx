import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealprepView from './index'
import {
  useCurrentMealPlan,
  useGenerateMealPlan,
  useDeleteMealPlan,
  useConsolidateMealPlan,
  useCreateShoppingListFromMealPlan,
} from '../../hooks/useMealPlan'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteToggle } from '../../hooks/useFavorites'
import '../../i18n'
import i18n from '../../i18n'

vi.mock('../../hooks/useMealPlan')
vi.mock('../../hooks/useRecipes')
vi.mock('../../hooks/useFavorites')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function mutationSpy(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, ...overrides }
}

function favoriteToggleSpy(overrides: Record<string, unknown> = {}) {
  return {
    requestToggle: vi.fn(),
    confirmRemove: vi.fn(),
    cancelRemove: vi.fn(),
    pendingRemoveId: null,
    isPending: false,
    ...overrides,
  }
}

function renderMealprepView(props: Partial<Parameters<typeof MealprepView>[0]> = {}) {
  return render(
    <MealprepView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} {...props} />,
  )
}

const mealPlan = {
  id: 'plan1',
  weekStart: new Date().toISOString(),
  days: [{ id: 'e1', dayOfWeek: 0, recipeId: 101, title: 'Arroz con pollo', image: 'img.jpg' }],
}

describe('MealprepView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: null, isLoading: false } as never)
    vi.mocked(useGenerateMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(useDeleteMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(useConsolidateMealPlan).mockReturnValue(mutationSpy({ data: undefined }) as never)
    vi.mocked(useCreateShoppingListFromMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(useRecipeDetail).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)
    vi.mocked(useFavoriteIds).mockReturnValue({ data: [] } as never)
    vi.mocked(useFavoriteToggle).mockReturnValue(favoriteToggleSpy() as never)
  })

  it('shows a signed-out prompt when not signed in', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true })
    renderMealprepView()
    expect(screen.getByText(i18n.t('mealprep.signedOutTitle'))).toBeInTheDocument()
  })

  it('shows the generator when there is no current plan', () => {
    renderMealprepView()
    expect(screen.getByText(i18n.t('mealprep.generate'))).toBeInTheDocument()
  })

  it('generates a plan with the chosen servings', async () => {
    const generateMealPlan = mutationSpy()
    vi.mocked(useGenerateMealPlan).mockReturnValue(generateMealPlan as never)

    renderMealprepView()
    await userEvent.click(screen.getByText(i18n.t('mealprep.generate')))

    expect(generateMealPlan.mutate).toHaveBeenCalledWith({ dietaryRestrictions: [], servings: 2 })
  })

  it('renders the weekly calendar from the current plan', () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    renderMealprepView()
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
  })

  it('previews the consolidated list, then confirms and reports the new list id', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    const consolidate = mutationSpy({
      mutate: vi.fn((_id, opts) =>
        opts?.onSuccess?.([{ name: 'rice', quantity: '200 g', pantryNote: false }]),
      ),
    })
    vi.mocked(useConsolidateMealPlan).mockReturnValue(consolidate as never)
    const createShoppingList = mutationSpy({
      mutate: vi.fn((_payload, opts) => opts?.onSuccess?.('list1')),
    })
    vi.mocked(useCreateShoppingListFromMealPlan).mockReturnValue(createShoppingList as never)
    const onSentToList = vi.fn()

    renderMealprepView({ onSentToList })
    await userEvent.click(screen.getByText(i18n.t('mealprep.consolidatedList.pushToShoppingList')))

    expect(consolidate.mutate).toHaveBeenCalledWith('plan1', expect.anything())
    await waitFor(() => expect(screen.getByText('rice')).toBeInTheDocument())

    await userEvent.click(screen.getByText(i18n.t('mealprep.consolidatedList.pushToShoppingList')))
    expect(createShoppingList.mutate).toHaveBeenCalledWith(
      { weekStart: mealPlan.weekStart, items: [{ name: 'rice', quantity: '200 g', pantryNote: false }] },
      expect.anything(),
    )
    await waitFor(() => expect(onSentToList).toHaveBeenCalledWith('list1'))
  })

  it('shows a delete confirmation before deleting the current plan', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    const deleteMealPlan = mutationSpy()
    vi.mocked(useDeleteMealPlan).mockReturnValue(deleteMealPlan as never)

    renderMealprepView()
    await userEvent.click(screen.getByText(i18n.t('mealprep.deletePlan')))
    expect(screen.getByText(i18n.t('mealprep.deletePlanConfirmTitle'))).toBeInTheDocument()

    await userEvent.click(screen.getAllByText(i18n.t('mealprep.deletePlan'))[1])
    expect(deleteMealPlan.mutate).toHaveBeenCalledWith('plan1')
  })
})
