import type { Product, ShoppingListItem } from '../utils/types'

const API_URL = import.meta.env.VITE_API_URL ?? ''

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'Server error')
  }
  return res.json() as Promise<T>
}

type ApiProduct = Omit<Product, 'id'> & { id: number }
type ApiShoppingItem = Omit<ShoppingListItem, 'id'> & { id: number }

// ── Products ──────────────────────────────────────────────────────────────────

export async function apiGetProducts(token: string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/pantry/products`, { headers: headers(token) })
  const json = await handleResponse<{ products: ApiProduct[] }>(res)
  return json.products
}

export async function apiCreateProduct(token: string, data: Omit<Product, 'id'>): Promise<Product> {
  const res = await fetch(`${API_URL}/api/pantry/products`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  })
  const json = await handleResponse<{ product: ApiProduct }>(res)
  return json.product
}

export async function apiUpdateProduct(token: string, id: number, data: Omit<Product, 'id'>): Promise<Product> {
  const res = await fetch(`${API_URL}/api/pantry/products/${id}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(data),
  })
  const json = await handleResponse<{ product: ApiProduct }>(res)
  return json.product
}

export async function apiDeleteProduct(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/pantry/products/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

// ── Shopping list ─────────────────────────────────────────────────────────────

export async function apiGetShoppingItems(token: string): Promise<ShoppingListItem[]> {
  const res = await fetch(`${API_URL}/api/pantry/shopping`, { headers: headers(token) })
  const json = await handleResponse<{ items: ApiShoppingItem[] }>(res)
  return json.items
}

export async function apiCreateShoppingItem(token: string, data: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem> {
  const res = await fetch(`${API_URL}/api/pantry/shopping`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  })
  const json = await handleResponse<{ item: ApiShoppingItem }>(res)
  return json.item
}

export async function apiUpdateShoppingItem(token: string, id: number, data: Partial<Omit<ShoppingListItem, 'id'>>): Promise<ShoppingListItem> {
  const res = await fetch(`${API_URL}/api/pantry/shopping/${id}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(data),
  })
  const json = await handleResponse<{ item: ApiShoppingItem }>(res)
  return json.item
}

export async function apiDeleteShoppingItem(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/pantry/shopping/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiClearPurchasedItems(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/pantry/shopping`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}
