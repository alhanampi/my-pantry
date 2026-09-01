import type { Product, ShoppingListItem, ProductFormData, ShoppingList } from '../utils/types'

const PRODUCTS_KEY = 'guest_products'
const SHOPPING_KEY = 'guest_shopping'
const SHOPPING_LISTS_KEY = 'guest_shopping_lists'
const FAVORITE_RECIPES_KEY = 'guest_favorite_recipes'
const UNIT_SYSTEM_KEY = 'guest_unit_system'

const GENERAL_LIST_ID = 'guest-general'

function readProducts(): Product[] {
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function readShopping(): ShoppingListItem[] {
  try {
    return JSON.parse(localStorage.getItem(SHOPPING_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeProducts(items: Product[]): void {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(items))
}

function writeShopping(items: ShoppingListItem[]): void {
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(items))
}

function readShoppingLists(): ShoppingList[] {
  try {
    const raw = localStorage.getItem(SHOPPING_LISTS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeShoppingLists(lists: ShoppingList[]): void {
  localStorage.setItem(SHOPPING_LISTS_KEY, JSON.stringify(lists))
}

function readFavoriteIds(): number[] {
  try {
    const raw = localStorage.getItem(FAVORITE_RECIPES_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeFavoriteIds(ids: number[]): void {
  localStorage.setItem(FAVORITE_RECIPES_KEY, JSON.stringify(ids))
}

// Lazily seeds the guest "General" list on first access — mirrors the
// backend's ensureGeneralList so both storages behave the same way.
function ensureGeneralList(): ShoppingList[] {
  const lists = readShoppingLists()
  if (lists.some((l) => l.isGeneral)) return lists
  const general: ShoppingList = {
    id: GENERAL_LIST_ID,
    name: 'General',
    ownerId: 'guest',
    isGeneral: true,
    createdAt: new Date().toISOString(),
  }
  const next = [general, ...lists]
  writeShoppingLists(next)
  return next
}

export const guestStorage = {
  getProducts: readProducts,
  getShopping: readShopping,

  getShoppingLists(): ShoppingList[] {
    return ensureGeneralList()
  },

  createShoppingList(name: string): ShoppingList {
    const lists = ensureGeneralList()
    const list: ShoppingList = {
      id: `guest-list-${Date.now()}`,
      name,
      ownerId: 'guest',
      isGeneral: false,
      createdAt: new Date().toISOString(),
    }
    writeShoppingLists([...lists, list])
    return list
  },

  updateShoppingList(id: string, name: string): ShoppingList {
    const lists = ensureGeneralList().map((l) => (l.id === id ? { ...l, name } : l))
    writeShoppingLists(lists)
    return lists.find((l) => l.id === id)!
  },

  deleteShoppingList(id: string): void {
    const lists = ensureGeneralList()
    const target = lists.find((l) => l.id === id)
    if (!target || target.isGeneral) return
    writeShoppingLists(lists.filter((l) => l.id !== id))
    writeShopping(readShopping().filter((i) => i.listId !== id))
  },

  getFavoriteIds: readFavoriteIds,

  // null = never explicitly chosen — the caller resolves a default from the
  // UI language in that case (see resolveUnitSystem in useUnitSystem.ts).
  getUnitSystem(): 'metric' | 'imperial' | null {
    const raw = localStorage.getItem(UNIT_SYSTEM_KEY)
    return raw === 'metric' || raw === 'imperial' ? raw : null
  },

  setUnitSystem(value: 'metric' | 'imperial'): void {
    localStorage.setItem(UNIT_SYSTEM_KEY, value)
  },

  addFavorite(recipeId: number): number[] {
    const ids = readFavoriteIds()
    if (ids.includes(recipeId)) return ids
    const next = [...ids, recipeId]
    writeFavoriteIds(next)
    return next
  },

  removeFavorite(recipeId: number): number[] {
    const next = readFavoriteIds().filter((id) => id !== recipeId)
    writeFavoriteIds(next)
    return next
  },

  createProduct(data: ProductFormData): Product {
    const product: Product = { ...data, id: Date.now() }
    writeProducts([...readProducts(), product])
    return product
  },

  updateProduct(id: number, data: Partial<ProductFormData>): Product {
    const items = readProducts().map((p) => (p.id === id ? { ...p, ...data } : p))
    writeProducts(items)
    return items.find((p) => p.id === id)!
  },

  deleteProduct(id: number): void {
    writeProducts(readProducts().filter((p) => p.id !== id))
  },

  createShoppingItem(data: Omit<ShoppingListItem, 'id'>): ShoppingListItem {
    ensureGeneralList()
    const item: ShoppingListItem = { ...data, id: Date.now(), listId: data.listId || GENERAL_LIST_ID }
    writeShopping([...readShopping(), item])
    return item
  },

  updateShoppingItem(id: number, data: Partial<Omit<ShoppingListItem, 'id'>>): ShoppingListItem {
    const items = readShopping().map((i) => (i.id === id ? { ...i, ...data } : i))
    writeShopping(items)
    return items.find((i) => i.id === id)!
  },

  deleteShoppingItem(id: number): void {
    writeShopping(readShopping().filter((i) => i.id !== id))
  },

  clearPurchased(listId?: string): void {
    writeShopping(readShopping().filter((i) => !i.purchased || (listId ? i.listId !== listId : false)))
  },

  removeMigratedItems(productIds: number[], shoppingIds: number[]): void {
    const pIds = new Set(productIds)
    const sIds = new Set(shoppingIds)
    if (pIds.size > 0) writeProducts(readProducts().filter((p) => !pIds.has(p.id)))
    if (sIds.size > 0) writeShopping(readShopping().filter((i) => !sIds.has(i.id)))
  },

  clearAll(): void {
    localStorage.removeItem(PRODUCTS_KEY)
    localStorage.removeItem(SHOPPING_KEY)
    localStorage.removeItem(SHOPPING_LISTS_KEY)
    localStorage.removeItem(FAVORITE_RECIPES_KEY)
    localStorage.removeItem(UNIT_SYSTEM_KEY)
  },
}
