import type { MealPlan, MealPlanEntry, ConsolidatedShoppingItem, Coordinates, MealType } from '../utils/types'

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

export interface GenerateMealPlanPayload {
  dietaryRestrictions: string[]
  servings: number
  daysCount?: number
  includeBreakfast?: boolean
  timeAvailableMinutes?: number
  ingredientsOnHand?: string[]
  weekStart?: string
  location?: Coordinates
}

export async function apiGenerateMealPlan(
  token: string,
  payload: GenerateMealPlanPayload,
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

export async function apiRefineMealPlan(
  token: string,
  id: string,
  message: string,
  lang: string,
  location?: Coordinates,
): Promise<MealPlan> {
  const res = await fetch(`${API_URL}/api/chat/meal-plan/${id}/refine?lang=${lang}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ message, location }),
  })
  const json = await handleResponse<{ mealPlan: MealPlan }>(res)
  return json.mealPlan
}

export async function apiSwapMeal(
  token: string,
  id: string,
  payload: { dayOfWeek: number; mealType: MealType; reason?: string; location?: Coordinates },
  lang: string,
): Promise<MealPlanEntry> {
  const res = await fetch(`${API_URL}/api/chat/meal-plan/${id}/swap-meal?lang=${lang}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  })
  const json = await handleResponse<{ entry: MealPlanEntry }>(res)
  return json.entry
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
