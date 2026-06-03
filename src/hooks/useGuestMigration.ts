import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { apiCreateProduct, apiCreateShoppingItem } from '../api/pantryApi'
import { guestStorage } from './useGuestStorage'

export function useGuestMigration() {
  const { getToken } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const guestProducts = guestStorage.getProducts()
      const guestShopping = guestStorage.getShopping()
      if (guestProducts.length === 0 && guestShopping.length === 0) return

      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

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
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })
}
