import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import type { RecipeCard, RecipeDetail } from '../utils/types'
import { guestStorage } from './useGuestStorage'
import {
  apiGetFavoriteIds,
  apiGetFavoriteRecipes,
  apiAddFavorite,
  apiRemoveFavorite,
  apiGetRecipeDetail,
} from '../api/recipesApi'

// Same guest/signed-in duality as usePantry.ts: signed-in reads/writes go
// through the backend (per-user DB rows), guests get a localStorage array of
// recipe ids via guestStorage. Both are exposed through the same hook
// interface so RecipesView/FavoriteRecipesView never branch on auth state.

function recipeDetailToCard(detail: RecipeDetail): RecipeCard {
  return {
    id: detail.id,
    title: detail.title,
    image: detail.image,
    servings: detail.servings,
    readyInMinutes: detail.readyInMinutes,
    ingredientNames: detail.ingredients.map((i) => i.name),
    calories: detail.nutrition.calories,
  }
}

export function useFavoriteIds() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['recipes', 'favorites', 'ids'],
    queryFn: async (): Promise<number[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetFavoriteIds(token)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest ? (): number[] => guestStorage.getFavoriteIds() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })
}

// Only meant to be used while the Favorites tab is mounted (same pattern as
// useRecipeSearch/useRecipeDetail — the view only exists while selected, so
// there's no separate `enabled` gate needed beyond signed-in/guest).
export function useFavoriteRecipes() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const { i18n } = useTranslation()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['recipes', 'favorites', 'cards', i18n.language],
    queryFn: async (): Promise<RecipeCard[]> => {
      if (isConfirmedGuest) {
        const ids = guestStorage.getFavoriteIds()
        const details = await Promise.all(
          ids.map((id) => apiGetRecipeDetail(id, i18n.language).catch(() => null)),
        )
        return details.filter((d): d is RecipeDetail => d !== null).map(recipeDetailToCard)
      }
      const token = await getToken()
      if (!token) return []
      const { results } = await apiGetFavoriteRecipes(token, i18n.language)
      return results
    },
    enabled: isConfirmedGuest || !!isSignedIn,
  })
}

function useToggleFavorite() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ recipeId, isFavorite }: { recipeId: number; isFavorite: boolean }): Promise<void> => {
      if (isConfirmedGuest) {
        if (isFavorite) guestStorage.removeFavorite(recipeId)
        else guestStorage.addFavorite(recipeId)
        return
      }
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      if (isFavorite) await apiRemoveFavorite(token, recipeId)
      else await apiAddFavorite(token, recipeId)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recipes', 'favorites'] })
    },
  })
}

// Wraps useToggleFavorite with a confirm-before-remove step: saving a recipe
// happens immediately (low-stakes, reversible with one tap), but unsaving one
// asks for confirmation first — same "are you sure" pattern as deleting a
// shopping list. RecipesView and FavoriteRecipesView both use this instead of
// useToggleFavorite directly, and each renders its own ConfirmActionDialog
// driven by `pendingRemoveId`.
export function useFavoriteToggle() {
  const toggle = useToggleFavorite()
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null)

  const requestToggle = (recipeId: number, isFavorite: boolean): void => {
    if (isFavorite) {
      setPendingRemoveId(recipeId)
    } else {
      toggle.mutate({ recipeId, isFavorite: false })
    }
  }

  const confirmRemove = (): void => {
    if (pendingRemoveId !== null) toggle.mutate({ recipeId: pendingRemoveId, isFavorite: true })
    setPendingRemoveId(null)
  }

  const cancelRemove = (): void => setPendingRemoveId(null)

  return {
    requestToggle,
    confirmRemove,
    cancelRemove,
    pendingRemoveId,
    isPending: toggle.isPending,
    // Which specific recipe's toggle request is currently in flight — lets a
    // list of cards show a spinner only on the one actually being toggled,
    // not the whole list. React Query exposes `.variables` for the duration
    // of a pending mutation.
    pendingRecipeId: toggle.isPending ? toggle.variables?.recipeId : undefined,
  }
}
