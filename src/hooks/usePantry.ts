import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import type { Product, ShoppingListItem, ProductFormData, ShoppingList, RecipeIngredient } from '../utils/types'
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
  apiGetShoppingLists,
  apiCreateShoppingList,
} from '../api/pantryApi'

export function usePantry(selectedListId?: string) {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const qc = useQueryClient()

  // Only a *confirmed* guest (Clerk finished loading and there's no session)
  // gets the localStorage seed as initialData — that's their real, only data
  // source, so the query can report success instantly with no fetch. For a
  // confirmed signed-in user, guestStorage is almost always empty/irrelevant;
  // seeding it as initialData would make React Query report the query as
  // already "successful" before the real fetch runs, so isLoading would be
  // false and the UI would flash an empty list instead of the skeleton while
  // the real data is still in flight. Leaving initialData undefined for that
  // case keeps isLoading true until the first real fetch resolves.
  const isConfirmedGuest = isLoaded && !isSignedIn

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetProducts(token)
    },
    enabled: !!isSignedIn,
    // initialDataUpdatedAt:0 marks the seed as stale so it refetches as soon
    // as the query becomes enabled (guest → signed-in transition).
    initialData: isConfirmedGuest ? (): Product[] => guestStorage.getProducts() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })

  const { data: shoppingLists = [], isLoading: loadingShoppingLists } = useQuery({
    queryKey: ['shoppingLists'],
    queryFn: async (): Promise<ShoppingList[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetShoppingLists(token)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest ? (): ShoppingList[] => guestStorage.getShoppingLists() : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })

  const generalList = shoppingLists.find((l) => l.isGeneral)
  const activeListId = selectedListId ?? generalList?.id

  const { data: shoppingList = [], isLoading: loadingShoppingList } = useQuery({
    queryKey: ['shoppingList', activeListId],
    queryFn: async (): Promise<ShoppingListItem[]> => {
      const token = await getToken()
      if (!token) return []
      return apiGetShoppingItems(token, activeListId)
    },
    enabled: !!isSignedIn,
    initialData: isConfirmedGuest
      ? (): ShoppingListItem[] => {
          const all = guestStorage.getShopping()
          return activeListId ? all.filter((i) => i.listId === activeListId) : all
        }
      : undefined,
    initialDataUpdatedAt: isConfirmedGuest ? 0 : undefined,
  })

  // Sync the React Query cache from localStorage after each guest mutation
  function syncGuest() {
    qc.setQueryData<Product[]>(['products'], guestStorage.getProducts())
    qc.setQueryData<ShoppingList[]>(['shoppingLists'], guestStorage.getShoppingLists())
    const all = guestStorage.getShopping()
    qc.setQueryData<ShoppingListItem[]>(
      ['shoppingList', activeListId],
      activeListId ? all.filter((i) => i.listId === activeListId) : all,
    )
  }

  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData): Promise<Product> => {
      if (!isSignedIn) return guestStorage.createProduct(data)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiCreateProduct(token, data)
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
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
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (!isSignedIn) return guestStorage.deleteProduct(id)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiDeleteProduct(token, id)
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const createShoppingItem = useMutation({
    mutationFn: async (data: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem> => {
      if (!isSignedIn) return guestStorage.createShoppingItem(data)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiCreateShoppingItem(token, data)
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
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
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })

  const deleteShoppingItem = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (!isSignedIn) return guestStorage.deleteShoppingItem(id)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiDeleteShoppingItem(token, id)
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })

  const clearPurchasedItems = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!isSignedIn) return guestStorage.clearPurchased(activeListId)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiClearPurchasedItems(token, activeListId)
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })

  const createShoppingList = useMutation({
    mutationFn: async (name: string): Promise<ShoppingList> => {
      if (!isSignedIn) return guestStorage.createShoppingList(name)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return apiCreateShoppingList(token, name)
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['shoppingLists'] })
    },
  })

  // Creates a new shopping list titled with the recipe name, then creates one
  // item per ingredient in it (already scaled by the caller). Returns the new
  // list's id so the UI can offer "view list" (switch to Shopping tab with it
  // selected).
  const sendRecipeToShoppingList = useMutation({
    mutationFn: async ({
      recipeTitle,
      ingredients,
    }: {
      recipeTitle: string
      ingredients: RecipeIngredient[]
    }): Promise<string> => {
      const list = isSignedIn
        ? await (async () => {
            const token = await getToken()
            if (!token) throw new Error('Not authenticated')
            return apiCreateShoppingList(token, recipeTitle)
          })()
        : guestStorage.createShoppingList(recipeTitle)

      const itemPayloads = ingredients.map(
        (ing): Omit<ShoppingListItem, 'id'> => ({
          name: ing.name,
          quantity: `${ing.amount} ${ing.unit}`.trim(),
          brand: '',
          purchaseDate: '',
          expiryDate: '',
          location: '',
          details: '',
          purchased: false,
          listId: list.id,
        }),
      )

      if (!isSignedIn) {
        await Promise.all(itemPayloads.map((item) => Promise.resolve(guestStorage.createShoppingItem(item))))
        return list.id
      }

      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await Promise.all(itemPayloads.map((item) => apiCreateShoppingItem(token, item)))
      return list.id
    },
    onSuccess: () => {
      if (!isSignedIn) { syncGuest(); return }
      void qc.invalidateQueries({ queryKey: ['shoppingLists'] })
      void qc.invalidateQueries({ queryKey: ['shoppingList'] })
    },
  })

  return {
    products,
    shoppingList,
    shoppingLists,
    activeListId,
    isLoading: loadingProducts || loadingShoppingList || loadingShoppingLists,
    createProduct,
    updateProduct,
    deleteProduct,
    createShoppingItem,
    updateShoppingItem,
    deleteShoppingItem,
    clearPurchasedItems,
    createShoppingList,
    sendRecipeToShoppingList,
  }
}
