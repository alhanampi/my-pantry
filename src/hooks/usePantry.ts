import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import type { Product, ShoppingListItem, ProductFormData } from '../utils/types'
import { guestStorage } from './useGuestStorage'
import {
  apiGetProducts,
  apiCreateProduct,
  apiUpdateProduct,
  apiDeleteProduct,
  apiGetShoppingItems,
  apiCreateShoppingItem,
  apiUpdateShoppingItem,
  apiDeleteShoppingItem,
  apiClearPurchasedItems,
} from '../api/pantryApi'

export function usePantry() {
  const { getToken, isSignedIn } = useAuth()
  const qc = useQueryClient()

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      if (!isSignedIn) return guestStorage.getProducts()
      const token = await getToken()
      if (!token) return []
      return apiGetProducts(token)
    },
  })

  const { data: shoppingList = [], isLoading: loadingShoppingList } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: async (): Promise<ShoppingListItem[]> => {
      if (!isSignedIn) return guestStorage.getShopping()
      const token = await getToken()
      if (!token) return []
      return apiGetShoppingItems(token)
    },
  })

  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData): Promise<Product> => {
      if (!isSignedIn) return guestStorage.createProduct(data)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiCreateProduct(token, data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProductFormData> }): Promise<Product> => {
      if (!isSignedIn) return guestStorage.updateProduct(id, data)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const current = products.find((p) => p.id === id)
      if (!current) throw new Error('Product not found')
      return apiUpdateProduct(token, id, { ...current, ...data })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (!isSignedIn) return guestStorage.deleteProduct(id)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiDeleteProduct(token, id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const createShoppingItem = useMutation({
    mutationFn: async (data: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem> => {
      if (!isSignedIn) return guestStorage.createShoppingItem(data)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiCreateShoppingItem(token, data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shoppingList'] }),
  })

  const updateShoppingItem = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<Omit<ShoppingListItem, 'id'>>
    }): Promise<ShoppingListItem> => {
      if (!isSignedIn) return guestStorage.updateShoppingItem(id, data)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiUpdateShoppingItem(token, id, data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shoppingList'] }),
  })

  const deleteShoppingItem = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (!isSignedIn) return guestStorage.deleteShoppingItem(id)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiDeleteShoppingItem(token, id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shoppingList'] }),
  })

  const clearPurchasedItems = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!isSignedIn) return guestStorage.clearPurchased()
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiClearPurchasedItems(token)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shoppingList'] }),
  })

  return {
    products,
    shoppingList,
    isLoading: loadingProducts || loadingShoppingList,
    createProduct,
    updateProduct,
    deleteProduct,
    createShoppingItem,
    updateShoppingItem,
    deleteShoppingItem,
    clearPurchasedItems,
  }
}
