const API_URL = import.meta.env.VITE_API_URL ?? ''

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

export interface PendingInvite {
  token: string
  senderUsername: string
  expiresAt: string
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

export async function apiSendInvite(
  token: string,
  username: string,
): Promise<{ recipientUsername: string }> {
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
    const json = (await res.json()) as { recipientUsername: string }
    return { recipientUsername: json.recipientUsername }
  } catch (err) {
    throw new Error(extractMessage(err))
  }
}

export async function apiGetInviteInfo(
  authToken: string,
  inviteToken: string,
): Promise<{ senderUsername: string; expiresAt: string }> {
  const res = await fetch(`${API_URL}/api/auth/invite/${inviteToken}`, {
    headers: headers(authToken),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'auth.errorGeneric')
  }
  return res.json() as Promise<{ senderUsername: string; expiresAt: string }>
}

export async function apiConfirmInvite(
  authToken: string,
  inviteToken: string,
): Promise<{ partner: Partner }> {
  const res = await fetch(`${API_URL}/api/auth/invite/confirm`, {
    method: 'POST',
    headers: headers(authToken),
    body: JSON.stringify({ token: inviteToken }),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'auth.errorGeneric')
  }
  return res.json() as Promise<{ partner: Partner }>
}

export async function apiDeclineInvite(authToken: string, inviteToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/invite/decline`, {
    method: 'POST',
    headers: headers(authToken),
    body: JSON.stringify({ token: inviteToken }),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? 'auth.errorGeneric')
  }
}

export async function apiGetPendingInvites(token: string): Promise<{ invites: PendingInvite[] }> {
  const res = await fetch(`${API_URL}/api/auth/invite/pending`, {
    headers: headers(token),
  })
  if (!res.ok) return { invites: [] }
  return res.json() as Promise<{ invites: PendingInvite[] }>
}
