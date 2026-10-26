import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { guestStorage } from './useGuestStorage'
import {
  apiGetFavoriteIngredients,
  apiAddFavoriteIngredient,
  apiRemoveFavoriteIngredient,
} from '../api/favoritesApi'

// Same guest/signed-in duality as useFavorites.ts — signed-in reads/writes
// go through the backend, guests get a localStorage array of names via
// guestStorage. Unlike recipe favorites, there's nothing to hydrate: the
// saved value (a plain name) is already everything there is.

export function useFavoriteIngredients() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['favorites', 'ingredients'],
    queryFn: async (): Promise<string[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetFavoriteIngredients(token)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest ? (): string[] => guestStorage.getFavoriteIngredients() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })
}

export function useToggleFavoriteIngredient() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, isFavorite }: { name: string; isFavorite: boolean }): Promise<void> => {
      if (isConfirmedGuest) {
        if (isFavorite) guestStorage.removeFavoriteIngredient(name)
        else guestStorage.addFavoriteIngredient(name)
        return
      }
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      if (isFavorite) await apiRemoveFavoriteIngredient(token, name)
      else await apiAddFavoriteIngredient(token, name)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites', 'ingredients'] })
    },
  })
}
