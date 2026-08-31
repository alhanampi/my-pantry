import type { Product, ShoppingListItem, ShoppingList } from '../utils/types'

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

export async function apiGetShoppingItems(token: string, listId?: string): Promise<ShoppingListItem[]> {
  const qs = listId ? `?listId=${encodeURIComponent(listId)}` : ''
  const res = await fetch(`${API_URL}/api/pantry/shopping${qs}`, { headers: headers(token) })
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

export async function apiClearPurchasedItems(token: string, listId?: string): Promise<void> {
  const qs = listId ? `?listId=${encodeURIComponent(listId)}` : ''
  const res = await fetch(`${API_URL}/api/pantry/shopping${qs}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

// ── Shopping lists ────────────────────────────────────────────────────────────

type ApiShoppingList = ShoppingList

export async function apiGetShoppingLists(token: string): Promise<ShoppingList[]> {
  const res = await fetch(`${API_URL}/api/pantry/shopping-lists`, { headers: headers(token) })
  const json = await handleResponse<{ lists: ApiShoppingList[] }>(res)
  return json.lists
}

export async function apiCreateShoppingList(token: string, name: string): Promise<ShoppingList> {
  const res = await fetch(`${API_URL}/api/pantry/shopping-lists`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name }),
  })
  const json = await handleResponse<{ list: ApiShoppingList }>(res)
  return json.list
}

export async function apiUpdateShoppingList(token: string, id: string, name: string): Promise<ShoppingList> {
  const res = await fetch(`${API_URL}/api/pantry/shopping-lists/${id}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ name }),
  })
  const json = await handleResponse<{ list: ApiShoppingList }>(res)
  return json.list
}

export async function apiDeleteShoppingList(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/pantry/shopping-lists/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}
