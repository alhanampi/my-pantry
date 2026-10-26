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
