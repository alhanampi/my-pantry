const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function extractMessage(err: unknown): string {
  if (err instanceof Response) return 'auth.errorGeneric'
  return err instanceof Error ? err.message : 'auth.errorGeneric'
}

interface Partner {
  id: string
  username: string
}

export async function apiSyncUser(token: string): Promise<{ partner: Partner | null }> {
  const res = await fetch(`${API_URL}/api/auth/sync`, {
    method: 'POST',
    headers: headers(token),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'auth.errorGeneric')
  }
  const json = (await res.json()) as { user: { partner: Partner | null } }
  return { partner: json.user.partner }
}

export async function apiLinkUser(token: string, username: string): Promise<Partner> {
  try {
    const res = await fetch(`${API_URL}/api/auth/link`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ username }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(json.error ?? 'auth.errorGeneric')
    }
    const json = (await res.json()) as { partner: Partner }
    return json.partner
  } catch (err) {
    throw new Error(extractMessage(err))
  }
}
