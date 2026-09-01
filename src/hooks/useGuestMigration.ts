import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { apiCreateProduct, apiCreateShoppingItem } from '../api/pantryApi'
import { apiUpdateUnitSystem } from '../api/authApi'
import { guestStorage } from './useGuestStorage'

export function useGuestMigration() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const guestProducts = guestStorage.getProducts()
      const guestShopping = guestStorage.getShopping()
      // Only migrate if the guest actually touched the switch — an untouched
      // (null) guest preference must never overwrite whatever the account
      // already has set server-side.
      const guestUnitSystem = guestStorage.getUnitSystem()
      if (guestProducts.length === 0 && guestShopping.length === 0 && !guestUnitSystem) return

      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      if (guestUnitSystem) {
        // Best-effort — failing to carry over this one preference shouldn't
        // block/fail the rest of the migration or surface as the same error.
        await apiUpdateUnitSystem(token, guestUnitSystem).catch(() => {})
      }

      const [productResults, shoppingResults] = await Promise.all([
        Promise.allSettled(
          guestProducts.map(({ id, ...data }) =>
            apiCreateProduct(token, data).then(() => id)
          )
        ),
        Promise.allSettled(
          guestShopping.map(({ id, ...data }) =>
            apiCreateShoppingItem(token, data).then(() => id)
          )
        ),
      ])

      const migratedProductIds = productResults
        .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
        .map((r) => r.value)
      const migratedShoppingIds = shoppingResults
        .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
        .map((r) => r.value)

      guestStorage.removeMigratedItems(migratedProductIds, migratedShoppingIds)

      const anyFailed =
        productResults.some((r) => r.status === 'rejected') ||
        shoppingResults.some((r) => r.status === 'rejected')
      if (anyFailed) throw new Error('Some items could not be migrated')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
      void qc.invalidateQueries({ queryKey: ['unitSystem'] })
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
      void qc.invalidateQueries({ queryKey: ['unitSystem'] })
    },
  })
}
