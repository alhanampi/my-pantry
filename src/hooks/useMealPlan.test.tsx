import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useCurrentMealPlan,
  useGenerateMealPlan,
  useRefineMealPlan,
  useSwapMeal,
  useDeleteMealPlan,
  useConsolidateMealPlan,
  useCreateShoppingListFromMealPlan,
} from './useMealPlan'
import * as mealPlanApi from '../api/mealPlanApi'
import * as pantryApi from '../api/pantryApi'
import '../i18n'

vi.mock('../api/mealPlanApi')
vi.mock('../api/pantryApi')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMealPlan hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, getToken: vi.fn().mockResolvedValue('token-123') })
  })

  it('useCurrentMealPlan is disabled when signed out', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, getToken: vi.fn() })
    const { result } = renderHook(() => useCurrentMealPlan(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mealPlanApi.apiGetCurrentMealPlan).not.toHaveBeenCalled()
  })

  const baseMealPlan = {
    id: 'p1',
    weekStart: '',
    includeBreakfast: false,
    servings: 2,
    dietaryRestrictions: [],
    batchPrepPlan: null,
    days: [],
  }

  it('useCurrentMealPlan fetches the caller\'s current plan when signed in', async () => {
    vi.mocked(mealPlanApi.apiGetCurrentMealPlan).mockResolvedValue(baseMealPlan)
    const { result } = renderHook(() => useCurrentMealPlan(), { wrapper })
    await waitFor(() => expect(result.current.data?.id).toBe('p1'))
  })

  it('useGenerateMealPlan posts dietaryRestrictions/servings and invalidates the current plan', async () => {
    vi.mocked(mealPlanApi.apiGenerateMealPlan).mockResolvedValue(baseMealPlan)
    const { result } = renderHook(() => useGenerateMealPlan(), { wrapper })
    result.current.mutate({ dietaryRestrictions: ['vegan'], servings: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mealPlanApi.apiGenerateMealPlan).toHaveBeenCalledWith(
      'token-123',
      { dietaryRestrictions: ['vegan'], servings: 3 },
      expect.any(String),
    )
  })

  it('useRefineMealPlan posts the message and invalidates the current plan', async () => {
    vi.mocked(mealPlanApi.apiRefineMealPlan).mockResolvedValue(baseMealPlan)
    const { result } = renderHook(() => useRefineMealPlan(), { wrapper })
    result.current.mutate({ id: 'p1', message: 'make it spicier', location: { lat: 1, lng: 2 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mealPlanApi.apiRefineMealPlan).toHaveBeenCalledWith(
      'token-123',
      'p1',
      'make it spicier',
      expect.any(String),
      { lat: 1, lng: 2 },
    )
  })

  it('useSwapMeal posts the slot/reason and invalidates the current plan', async () => {
    vi.mocked(mealPlanApi.apiSwapMeal).mockResolvedValue({
      id: 'e1',
      dayOfWeek: 0,
      mealType: 'lunch',
      title: 'New lunch',
      description: '',
      image: '',
      ingredients: [],
      steps: [],
      notes: '',
      prepTimeMinutes: 10,
      totalTimeMinutes: 20,
    })
    const { result } = renderHook(() => useSwapMeal(), { wrapper })
    result.current.mutate({ id: 'p1', dayOfWeek: 0, mealType: 'lunch', reason: 'no pescado' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mealPlanApi.apiSwapMeal).toHaveBeenCalledWith(
      'token-123',
      'p1',
      { dayOfWeek: 0, mealType: 'lunch', reason: 'no pescado', location: undefined },
      expect.any(String),
    )
  })

  it('useDeleteMealPlan calls apiDeleteMealPlan with the plan id', async () => {
    vi.mocked(mealPlanApi.apiDeleteMealPlan).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteMealPlan(), { wrapper })
    result.current.mutate('p1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mealPlanApi.apiDeleteMealPlan).toHaveBeenCalledWith('token-123', 'p1')
  })

  it('useConsolidateMealPlan returns the consolidated remainder without creating anything', async () => {
    vi.mocked(mealPlanApi.apiConsolidateMealPlan).mockResolvedValue([
      { name: 'rice', quantity: '200 g', pantryNote: false },
    ])
    const { result } = renderHook(() => useConsolidateMealPlan(), { wrapper })
    result.current.mutate('p1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ name: 'rice', quantity: '200 g', pantryNote: false }])
    expect(pantryApi.apiCreateShoppingList).not.toHaveBeenCalled()
  })

  it('useCreateShoppingListFromMealPlan creates a list, then an item per consolidated line, marking pantryNote lines', async () => {
    vi.mocked(pantryApi.apiCreateShoppingList).mockResolvedValue({ id: 'list1', name: 'Meal plan', ownerId: 'u1', isGeneral: false, createdAt: '' })
    vi.mocked(pantryApi.apiCreateShoppingItem).mockResolvedValue({} as never)

    const { result } = renderHook(() => useCreateShoppingListFromMealPlan(), { wrapper })
    result.current.mutate({
      weekStart: '2026-01-01',
      items: [
        { name: 'rice', quantity: '200 g', pantryNote: false },
        { name: 'flour', quantity: '300 g', pantryNote: true },
      ],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('list1')
    expect(pantryApi.apiCreateShoppingItem).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ name: 'rice', details: '' }),
    )
    expect(pantryApi.apiCreateShoppingItem).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ name: 'flour', details: expect.any(String) }),
    )
  })
})
