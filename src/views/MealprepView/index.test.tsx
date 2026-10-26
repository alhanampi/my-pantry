import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealprepView from './index'
import {
  useCurrentMealPlan,
  useGenerateMealPlan,
  useRefineMealPlan,
  useSwapMeal,
  useDeleteMealPlan,
  useConsolidateMealPlan,
  useCreateShoppingListFromMealPlan,
} from '../../hooks/useMealPlan'
import { usePantry } from '../../hooks/usePantry'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useFavoriteIngredients, useToggleFavoriteIngredient } from '../../hooks/useFavoriteIngredients'
import { useFavoriteMealPlanSourceIds, useAddFavoriteMealPlan } from '../../hooks/useFavoriteMealPlans'
import '../../i18n'
import i18n from '../../i18n'

vi.mock('../../hooks/useMealPlan')
vi.mock('../../hooks/usePantry')
vi.mock('../../hooks/useGeolocation')
vi.mock('../../hooks/useFavoriteIngredients')
vi.mock('../../hooks/useFavoriteMealPlans')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function mutationSpy(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, ...overrides }
}

function renderMealprepView(props: Partial<Parameters<typeof MealprepView>[0]> = {}) {
  return render(
    <MealprepView sendRecipeToShoppingList={mutationSpy() as never} onSentToList={vi.fn()} {...props} />,
  )
}

function mealPlanMeal(title: string) {
  return {
    title,
    description: `${title} description`,
    image: '',
    ingredients: [{ name: 'rice', amount: 200, unit: 'g' }],
    steps: [`Cook ${title}`],
    notes: '',
    prepTimeMinutes: 10,
    totalTimeMinutes: 20,
  }
}

const mealPlan = {
  id: 'plan1',
  weekStart: new Date().toISOString(),
  includeBreakfast: false,
  servings: 2,
  dietaryRestrictions: [],
  batchPrepPlan: null,
  days: [
    { id: 'e1', dayOfWeek: 0, mealType: 'lunch' as const, ...mealPlanMeal('Arroz con pollo') },
    { id: 'e2', dayOfWeek: 0, mealType: 'dinner' as const, ...mealPlanMeal('Sopa de verduras') },
  ],
}

describe('MealprepView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: null, isLoading: false } as never)
    vi.mocked(useGenerateMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(useRefineMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(useSwapMeal).mockReturnValue(mutationSpy() as never)
    vi.mocked(useDeleteMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(useConsolidateMealPlan).mockReturnValue(mutationSpy({ data: undefined }) as never)
    vi.mocked(useCreateShoppingListFromMealPlan).mockReturnValue(mutationSpy() as never)
    vi.mocked(usePantry).mockReturnValue({ products: [] } as never)
    vi.mocked(useGeolocation).mockReturnValue({ coords: null, error: null, requestLocation: vi.fn() } as never)
    vi.mocked(useFavoriteIngredients).mockReturnValue({ data: [] } as never)
    vi.mocked(useToggleFavoriteIngredient).mockReturnValue({ mutate: vi.fn(), isPending: false } as never)
    vi.mocked(useFavoriteMealPlanSourceIds).mockReturnValue({ data: [] } as never)
    vi.mocked(useAddFavoriteMealPlan).mockReturnValue(mutationSpy() as never)
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

    expect(generateMealPlan.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ dietaryRestrictions: [], servings: 2, includeBreakfast: false }),
    )
  })

  it('shows an error message with a retry button when generation fails', async () => {
    const generateMealPlan = mutationSpy({ isError: true, error: new Error('emptyPlan'), reset: vi.fn() })
    vi.mocked(useGenerateMealPlan).mockReturnValue(generateMealPlan as never)

    renderMealprepView()

    expect(screen.getByText(i18n.t('mealprep.errors.emptyPlan'))).toBeInTheDocument()
    await userEvent.click(screen.getByText(i18n.t('mealprep.retry')))
    expect((generateMealPlan as unknown as { reset: () => void }).reset).toHaveBeenCalled()
  })

  it('maps a generic/unrecognized generation error to the generic message', () => {
    const generateMealPlan = mutationSpy({ isError: true, error: new Error('boom'), reset: vi.fn() })
    vi.mocked(useGenerateMealPlan).mockReturnValue(generateMealPlan as never)

    renderMealprepView()

    expect(screen.getByText(i18n.t('mealprep.errors.generic'))).toBeInTheDocument()
  })

  it('shows an error message with a retry button when a refine request fails', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    const refineMealPlan = mutationSpy({ isError: true, error: new Error('quotaExceeded'), reset: vi.fn() })
    vi.mocked(useRefineMealPlan).mockReturnValue(refineMealPlan as never)

    renderMealprepView()

    expect(screen.getByText(i18n.t('mealprep.errors.quotaExceeded'))).toBeInTheDocument()
    await userEvent.click(screen.getByText(i18n.t('mealprep.retry')))
    expect((refineMealPlan as unknown as { reset: () => void }).reset).toHaveBeenCalled()
  })

  it('renders the weekly calendar from the current plan, grouped by meal', () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    renderMealprepView()
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
    expect(screen.getByText('Sopa de verduras')).toBeInTheDocument()
  })

  it('opens a meal\'s detail on click, with no extra fetch', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    renderMealprepView()

    await userEvent.click(screen.getByText('Arroz con pollo'))

    expect(screen.getByText('Arroz con pollo description')).toBeInTheDocument()
    expect(screen.getByText('Cook Arroz con pollo')).toBeInTheDocument()
    await userEvent.click(screen.getByText(i18n.t('mealprep.backToCalendar')))
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument()
  })

  it('swaps a meal with the typed reason', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    const swapMeal = mutationSpy()
    vi.mocked(useSwapMeal).mockReturnValue(swapMeal as never)

    renderMealprepView()
    await userEvent.click(screen.getByText('Arroz con pollo'))
    await userEvent.click(screen.getByText(i18n.t('mealprep.swap.button')))
    await userEvent.type(screen.getByPlaceholderText(i18n.t('mealprep.swap.reasonPlaceholder')), 'no pescado')
    const confirmButtons = screen.getAllByText(i18n.t('mealprep.swap.confirm'))
    await userEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(swapMeal.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plan1', dayOfWeek: 0, mealType: 'lunch', reason: 'no pescado' }),
    )
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

  it('sends a free-text refinement for the current plan', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    const refineMealPlan = mutationSpy()
    vi.mocked(useRefineMealPlan).mockReturnValue(refineMealPlan as never)

    renderMealprepView()
    await userEvent.type(screen.getByPlaceholderText(i18n.t('mealprep.refine.placeholder')), 'less spicy{enter}')

    expect(refineMealPlan.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plan1', message: 'less spicy' }),
    )
  })

  it('shows the batch prep plan view when available', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({
      data: {
        ...mealPlan,
        batchPrepPlan: {
          menu: ['Arroz con pollo'],
          totalQuantities: [{ name: 'rice', amount: 200, unit: 'g' }],
          sharedComponents: [],
          cookingOrder: ['Preheat the oven.'],
          storageNotes: 'Store in the fridge.',
          estimatedTotalMinutes: 45,
        },
      },
      isLoading: false,
    } as never)

    renderMealprepView()
    await userEvent.click(screen.getByText(i18n.t('mealprep.batchPrepPlan.viewButton')))
    expect(screen.getByText('Preheat the oven.')).toBeInTheDocument()
  })

  it('favorites the current plan with the typed name', async () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    const addFavoriteMealPlan = mutationSpy({
      mutate: vi.fn((_payload, opts) => opts?.onSuccess?.()),
    })
    vi.mocked(useAddFavoriteMealPlan).mockReturnValue(addFavoriteMealPlan as never)

    renderMealprepView()
    await userEvent.click(screen.getByLabelText(i18n.t('mealprep.favoritePlan')))
    await userEvent.type(
      screen.getByPlaceholderText(i18n.t('mealprep.favoritePlanNamePlaceholder')),
      'Semana liviana',
    )
    await userEvent.click(screen.getByText(i18n.t('mealprep.favoritePlan'), { selector: 'button' }))

    expect(addFavoriteMealPlan.mutate).toHaveBeenCalledWith(
      { mealPlanId: 'plan1', name: 'Semana liviana' },
      expect.anything(),
    )
  })

  it('shows a filled, disabled heart once the current plan is already favorited', () => {
    vi.mocked(useCurrentMealPlan).mockReturnValue({ data: mealPlan, isLoading: false } as never)
    vi.mocked(useFavoriteMealPlanSourceIds).mockReturnValue({ data: ['plan1'] } as never)

    renderMealprepView()

    expect(screen.getByLabelText(i18n.t('mealprep.favoritePlanAlready'))).toBeDisabled()
  })
})
