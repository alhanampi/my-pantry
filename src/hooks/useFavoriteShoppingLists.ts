import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { guestStorage } from './useGuestStorage'
import {
  apiGetFavoriteShoppingListIds,
  apiGetFavoriteShoppingLists,
  apiAddFavoriteShoppingList,
  apiRemoveFavoriteShoppingList,
} from '../api/favoritesApi'
import type { FavoriteShoppingListSummary } from '../utils/types'

// Same guest/signed-in duality as useFavorites.ts. A favorite shopping list
// is a pointer at a live ShoppingList (not a snapshot — the list itself can
// be renamed/added to), so the backend hydrates name/isGeneral/itemCount via
// a join; for guests, the same join happens locally against guestStorage's
// own lists/items instead of a network call.

export function useFavoriteShoppingListIds() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['favorites', 'shoppingLists', 'ids'],
    queryFn: async (): Promise<string[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetFavoriteShoppingListIds(token)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest ? (): string[] => guestStorage.getFavoriteShoppingListIds() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })
}

export function useFavoriteShoppingLists() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['favorites', 'shoppingLists', 'summaries'],
    queryFn: async (): Promise<FavoriteShoppingListSummary[]> => {
      if (isConfirmedGuest) {
        const ids = new Set(guestStorage.getFavoriteShoppingListIds())
        const items = guestStorage.getShopping()
        return guestStorage
          .getShoppingLists()
          .filter((l) => ids.has(l.id))
          .map((l) => ({
            id: l.id,
            name: l.name,
            isGeneral: l.isGeneral,
            itemCount: items.filter((i) => i.listId === l.id).length,
          }))
      }
      const token = await getToken()
      if (!token) return []
      return apiGetFavoriteShoppingLists(token)
    },
    enabled: isConfirmedGuest || !!isSignedIn,
  })
}

export function useToggleFavoriteShoppingList() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId, isFavorite }: { listId: string; isFavorite: boolean }): Promise<void> => {
      if (isConfirmedGuest) {
        if (isFavorite) guestStorage.removeFavoriteShoppingList(listId)
        else guestStorage.addFavoriteShoppingList(listId)
        return
      }
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      if (isFavorite) await apiRemoveFavoriteShoppingList(token, listId)
      else await apiAddFavoriteShoppingList(token, listId)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites', 'shoppingLists'] })
    },
  })
}
