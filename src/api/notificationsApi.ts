const API_URL = import.meta.env.VITE_API_URL ?? ''

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'Server error')
  }
}

export async function apiSubscribe(
  token: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  const res = await fetch(`${API_URL}/api/notifications/subscribe`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(subscription),
  })
  await handleResponse(res)
}

export async function apiUnsubscribe(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/notifications/unsubscribe`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse(res)
}
