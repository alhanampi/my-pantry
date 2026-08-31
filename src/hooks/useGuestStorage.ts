import type { Product, ShoppingListItem, ProductFormData, ShoppingList } from '../utils/types'

const PRODUCTS_KEY = 'guest_products'
const SHOPPING_KEY = 'guest_shopping'
const SHOPPING_LISTS_KEY = 'guest_shopping_lists'

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
  },
}
