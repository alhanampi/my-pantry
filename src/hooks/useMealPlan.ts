import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import type { MealPlan, ShoppingListItem, ConsolidatedShoppingItem } from '../utils/types'
import {
  apiGenerateMealPlan,
  apiGetCurrentMealPlan,
  apiDeleteMealPlan,
  apiConsolidateMealPlan,
} from '../api/mealPlanApi'
import { apiCreateShoppingList, apiCreateShoppingItem } from '../api/pantryApi'

// Mealprep requires sign-in, same as Chat — meal plans are DB-persisted per
// account, nothing sensible to store for an anonymous guest.

async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  return token
}

export function useCurrentMealPlan() {
  const { getToken, isSignedIn } = useAuth()

  return useQuery({
    queryKey: ['mealPlan', 'current'],
    queryFn: async (): Promise<MealPlan | null> => {
      const token = await requireToken(getToken)
      return apiGetCurrentMealPlan(token)
    },
    enabled: !!isSignedIn,
  })
}

export function useGenerateMealPlan() {
  const { getToken } = useAuth()
  const { i18n } = useTranslation()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      dietaryRestrictions: string[]
      servings: number
      daysCount?: number
    }): Promise<MealPlan> => {
      const token = await requireToken(getToken)
      return apiGenerateMealPlan(token, payload, i18n.language)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mealPlan'] })
    },
  })
}

export function useDeleteMealPlan() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const token = await requireToken(getToken)
      return apiDeleteMealPlan(token, id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mealPlan'] })
    },
  })
}

// Fetches the consolidated remainder (union of every recipe's ingredients,
// minus what's already in the pantry) without creating anything yet —
// MealprepView shows this as a preview the user confirms before it's
// actually pushed to a shopping list.
export function useConsolidateMealPlan() {
  const { getToken } = useAuth()

  return useMutation({
    mutationFn: async (mealPlanId: string): Promise<ConsolidatedShoppingItem[]> => {
      const token = await requireToken(getToken)
      return apiConsolidateMealPlan(token, mealPlanId)
    },
  })
}

// Backend only computes the consolidated remainder (it's the only side with
// live pantry quantities via Prisma) — creating the ShoppingList/Items
// themselves stays client-side, mirroring usePantry.ts's
// sendRecipeToShoppingList, which already creates a list + items the same
// way for a single recipe. Takes the already-previewed items rather than
// re-consolidating, so what gets created matches exactly what the user saw.
export function useCreateShoppingListFromMealPlan() {
  const { getToken } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      weekStart,
      items,
    }: {
      weekStart: string
      items: ConsolidatedShoppingItem[]
    }): Promise<string> => {
      const token = await requireToken(getToken)

      const listName = t('mealprep.shoppingListName', { date: new Date(weekStart).toLocaleDateString() })
      const list = await apiCreateShoppingList(token, listName)

      const itemPayloads = items.map(
        (item): Omit<ShoppingListItem, 'id'> => ({
          name: item.name,
          quantity: item.quantity,
          brand: '',
          purchaseDate: '',
          expiryDate: '',
          location: '',
          details: item.pantryNote ? t('mealprep.pantryNoteDetail') : '',
          purchased: false,
          listId: list.id,
        }),
      )
      await Promise.all(itemPayloads.map((item) => apiCreateShoppingItem(token, item)))

      return list.id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shoppingLists'] })
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })
}
