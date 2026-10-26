import type { FavoriteStore, FavoriteShoppingListSummary } from '../utils/types'

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

// Favorite ingredients — bare name bookmarks, no hydration needed (unlike
// recipe favorites, the saved value is already everything there is).

export async function apiGetFavoriteIngredients(token: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/favorites/ingredients`, { headers: headers(token) })
  const json = await handleResponse<{ names: string[] }>(res)
  return json.names
}

export async function apiAddFavoriteIngredient(token: string, name: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/ingredients`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name }),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiRemoveFavoriteIngredient(token: string, name: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/ingredients/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

// ── Favorite stores — snapshots (name/type/coords as seen at favorite time,
// since there's no "detail by placeId" lookup to re-hydrate from later). ──

export async function apiGetFavoriteStoreIds(token: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/favorites/stores/ids`, { headers: headers(token) })
  const json = await handleResponse<{ placeIds: string[] }>(res)
  return json.placeIds
}

export async function apiGetFavoriteStores(token: string): Promise<FavoriteStore[]> {
  const res = await fetch(`${API_URL}/api/favorites/stores`, { headers: headers(token) })
  const json = await handleResponse<{ results: FavoriteStore[] }>(res)
  return json.results
}

export async function apiAddFavoriteStore(
  token: string,
  store: { placeId: string; name: string; type: string; lat: number; lon: number },
): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/stores`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(store),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiRemoveFavoriteStore(token: string, placeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/stores/${encodeURIComponent(placeId)}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

// ── Favorite shopping lists — pointers at a live ShoppingList, hydrated
// server-side with its name/isGeneral/item count. ──

export async function apiGetFavoriteShoppingListIds(token: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/favorites/shopping-lists/ids`, { headers: headers(token) })
  const json = await handleResponse<{ listIds: string[] }>(res)
  return json.listIds
}

export async function apiGetFavoriteShoppingLists(token: string): Promise<FavoriteShoppingListSummary[]> {
  const res = await fetch(`${API_URL}/api/favorites/shopping-lists`, { headers: headers(token) })
  const json = await handleResponse<{ results: FavoriteShoppingListSummary[] }>(res)
  return json.results
}

export async function apiAddFavoriteShoppingList(token: string, listId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/shopping-lists`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ listId }),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiRemoveFavoriteShoppingList(token: string, listId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/shopping-lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}
