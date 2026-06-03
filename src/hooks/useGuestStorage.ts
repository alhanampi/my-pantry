import type { Product, ShoppingListItem, ProductFormData } from '../utils/types'

const PRODUCTS_KEY = 'guest_products'
const SHOPPING_KEY = 'guest_shopping'

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

export const guestStorage = {
  getProducts: readProducts,
  getShopping: readShopping,

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
    const item: ShoppingListItem = { ...data, id: Date.now() }
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

  clearPurchased(): void {
    writeShopping(readShopping().filter((i) => !i.purchased))
  },
}
