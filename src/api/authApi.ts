import axios from 'axios'
import type { AuthUser } from '../utils/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const MOCK = import.meta.env.VITE_MOCK_AUTH === 'true'

// ─── Mock ─────────────────────────────────────────────────────────────────────

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

function mockUser(username: string, email: string): AuthUser {
  return { id: 1, username, email, partner: null }
}

// ─── Real API helpers ─────────────────────────────────────────────────────────

interface AuthResponse {
  token: string
  user: AuthUser
}

function authHeaders() {
  const token = localStorage.getItem('mi-despensa-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; errors?: { msg: string }[] } | undefined
    if (data?.errors?.length) return data.errors[0].msg
    if (data?.error) return data.error
  }
  return 'error.generic'
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, _password: string): Promise<AuthUser> {
  if (MOCK) {
    await delay()
    const username = email.split('@')[0] || 'user'
    return mockUser(username, email)
  }
  try {
    const { data } = await axios.post<AuthResponse>(`${API_URL}/api/auth/login`, {
      email,
      password: _password,
    })
    localStorage.setItem('mi-despensa-token', data.token)
    return data.user
  } catch (err) {
    throw new Error(extractMessage(err))
  }
}

export async function apiRegister(
  username: string,
  email: string,
  _password: string
): Promise<AuthUser> {
  if (MOCK) {
    await delay()
    return mockUser(username, email)
  }
  try {
    const { data } = await axios.post<AuthResponse>(`${API_URL}/api/auth/register`, {
      username,
      email,
      password: _password,
    })
    localStorage.setItem('mi-despensa-token', data.token)
    return data.user
  } catch (err) {
    throw new Error(extractMessage(err))
  }
}

export async function apiLinkUser(username: string): Promise<{ id: number; username: string }> {
  if (MOCK) {
    await delay()
    if (!username.trim()) throw new Error('Username is required')
    return { id: 2, username }
  }
  try {
    const { data } = await axios.post<{ partner: { id: number; username: string } }>(
      `${API_URL}/api/auth/link`,
      { username },
      { headers: authHeaders() }
    )
    return data.partner
  } catch (err) {
    throw new Error(extractMessage(err))
  }
}
