import type { MealPlan, ConsolidatedShoppingItem } from '../utils/types'

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

export async function apiGenerateMealPlan(
  token: string,
  payload: { dietaryRestrictions: string[]; servings: number; daysCount?: number },
  lang: string,
): Promise<MealPlan> {
  const res = await fetch(`${API_URL}/api/chat/meal-plan?lang=${lang}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  })
  const json = await handleResponse<{ mealPlan: MealPlan }>(res)
  return json.mealPlan
}

export async function apiGetCurrentMealPlan(token: string): Promise<MealPlan | null> {
  const res = await fetch(`${API_URL}/api/chat/meal-plan/current`, { headers: headers(token) })
  const json = await handleResponse<{ mealPlan: MealPlan | null }>(res)
  return json.mealPlan
}

export async function apiDeleteMealPlan(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/meal-plan/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiConsolidateMealPlan(token: string, id: string): Promise<ConsolidatedShoppingItem[]> {
  const res = await fetch(`${API_URL}/api/chat/meal-plan/${id}/consolidate`, {
    method: 'POST',
    headers: headers(token),
  })
  const json = await handleResponse<{ items: ConsolidatedShoppingItem[] }>(res)
  return json.items
}
