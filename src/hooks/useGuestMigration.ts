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

      await Promise.all([
        ...guestProducts.map(({ id: _id, ...data }) => apiCreateProduct(token, data)),
        ...guestShopping.map(({ id: _id, ...data }) => apiCreateShoppingItem(token, data)),
      ])
      guestStorage.clearAll()
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })
}
