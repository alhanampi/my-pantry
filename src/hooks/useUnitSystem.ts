import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { guestStorage } from './useGuestStorage'
import { apiGetMe, apiUpdateUnitSystem } from '../api/authApi'

export type UnitSystem = 'metric' | 'imperial'

// The account's own explicit choice always wins; when it's never been set
// (null — signed-in accounts default to null in the DB, guests default to
// null in localStorage), fall back to the UI language: Spanish -> metric,
// everything else -> imperial. Mirrored on the backend
// (chatAssistant.ts's resolveUnitSystem) — keep both in sync if this rule
// ever changes.
export function resolveUnitSystem(explicit: string | null | undefined, language: string): UnitSystem {
  if (explicit === 'metric' || explicit === 'imperial') return explicit
  return language.startsWith('es') ? 'metric' : 'imperial'
}

// Same guest/signed-in duality as useFavorites.ts/usePantry.ts: signed-in
// reads/writes go through the backend (a DB column on User), guests get a
// localStorage value via guestStorage. Both resolve through the same
// language-based default when unset, and both are exposed through one hook
// interface so callers (Header's Preferencias section, RecipeDetailPanel)
// never branch on auth state.
export function useUnitSystem() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const isConfirmedGuest = isLoaded && !isSignedIn

  const query = useQuery({
    queryKey: ['unitSystem'],
    queryFn: async (): Promise<UnitSystem | null> => {
      const token = await getToken()
      if (!token) return null
      const { unitSystem } = await apiGetMe(token)
      return unitSystem
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest ? (): UnitSystem | null => guestStorage.getUnitSystem() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })

  const mutation = useMutation({
    mutationFn: async (next: UnitSystem): Promise<UnitSystem> => {
      if (isConfirmedGuest) {
        guestStorage.setUnitSystem(next)
        return next
      }
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await apiUpdateUnitSystem(token, next)
      return next
    },
    onSuccess: (next) => {
      qc.setQueryData(['unitSystem'], next)
    },
  })

  return {
    unitSystem: resolveUnitSystem(query.data, i18n.language),
    setUnitSystem: (next: UnitSystem): void => mutation.mutate(next),
    isPending: mutation.isPending,
  }
}
