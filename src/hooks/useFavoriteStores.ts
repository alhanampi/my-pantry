import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { guestStorage } from './useGuestStorage'
import {
  apiGetFavoriteStoreIds,
  apiGetFavoriteStores,
  apiAddFavoriteStore,
  apiRemoveFavoriteStore,
} from '../api/favoritesApi'
import type { FavoriteStore, RawNearbyStore } from '../utils/types'

// Same guest/signed-in duality as useFavorites.ts. Unlike recipes, there's
// no provider "detail by id" lookup to re-hydrate a store from later, so a
// favorite store is a snapshot (saved as-is at favorite time) rather than a
// bookmark — both the backend and guestStorage persist the full
// name/type/coords, not just the placeId.

export function useFavoriteStoreIds() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['favorites', 'stores', 'ids'],
    queryFn: async (): Promise<string[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetFavoriteStoreIds(token)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest
      ? (): string[] => guestStorage.getFavoriteStores().map((s) => s.placeId)
      : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })
}

export function useFavoriteStores() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn

  return useQuery({
    queryKey: ['favorites', 'stores', 'snapshots'],
    queryFn: async (): Promise<FavoriteStore[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetFavoriteStores(token)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest ? (): FavoriteStore[] => guestStorage.getFavoriteStores() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })
}

export function useToggleFavoriteStore() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const isConfirmedGuest = isLoaded && !isSignedIn
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      store,
      isFavorite,
    }: {
      store: RawNearbyStore
      isFavorite: boolean
    }): Promise<void> => {
      if (isConfirmedGuest) {
        if (isFavorite) guestStorage.removeFavoriteStore(store.id)
        else
          guestStorage.addFavoriteStore({
            placeId: store.id,
            name: store.name,
            type: store.type,
            lat: store.lat,
            lon: store.lon,
          })
        return
      }
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      if (isFavorite) await apiRemoveFavoriteStore(token, store.id)
      else
        await apiAddFavoriteStore(token, {
          placeId: store.id,
          name: store.name,
          type: store.type,
          lat: store.lat,
          lon: store.lon,
        })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites', 'stores'] })
    },
  })
}
