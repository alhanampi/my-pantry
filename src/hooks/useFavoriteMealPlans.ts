import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import {
  apiGetFavoriteMealPlanSourceIds,
  apiGetFavoriteMealPlans,
  apiAddFavoriteMealPlan,
  apiRemoveFavoriteMealPlan,
  apiRestoreFavoriteMealPlan,
} from '../api/favoritesApi'
import type { FavoriteMealPlan, MealPlan } from '../utils/types'

// Mealprep requires sign-in end-to-end (see useMealPlan.ts), so unlike
// useFavoriteStores/useFavoriteShoppingLists there's no guest/localStorage
// branch to carry here.

async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  return token
}

// Lets MealprepView show "already favorited" for the plan on screen without
// fetching every snapshot's full content.
export function useFavoriteMealPlanSourceIds() {
  const { getToken, isSignedIn } = useAuth()

  return useQuery({
    queryKey: ['favorites', 'mealPlans', 'sourceIds'],
    queryFn: async (): Promise<string[]> => {
      const token = await requireToken(getToken)
      return apiGetFavoriteMealPlanSourceIds(token)
    },
    enabled: !!isSignedIn,
  })
}

export function useFavoriteMealPlans() {
  const { getToken, isSignedIn } = useAuth()

  return useQuery({
    queryKey: ['favorites', 'mealPlans', 'snapshots'],
    queryFn: async (): Promise<FavoriteMealPlan[]> => {
      const token = await requireToken(getToken)
      return apiGetFavoriteMealPlans(token)
    },
    enabled: !!isSignedIn,
  })
}

export function useAddFavoriteMealPlan() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { mealPlanId: string; name?: string }): Promise<void> => {
      const token = await requireToken(getToken)
      await apiAddFavoriteMealPlan(token, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites', 'mealPlans'] })
    },
  })
}

export function useRemoveFavoriteMealPlan() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const token = await requireToken(getToken)
      await apiRemoveFavoriteMealPlan(token, id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites', 'mealPlans'] })
    },
  })
}

// Also invalidates the live-plan query — restoring creates a new MealPlan
// that becomes "current" (most recently created), so MealprepView needs to
// pick it up via useCurrentMealPlan.
export function useRestoreFavoriteMealPlan() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<MealPlan> => {
      const token = await requireToken(getToken)
      return apiRestoreFavoriteMealPlan(token, id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mealPlan'] })
    },
  })
}
