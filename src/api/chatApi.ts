import type { ChatConversation, ChatMessageItem, RecipeCard } from '../utils/types'

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

export async function apiListConversations(token: string): Promise<ChatConversation[]> {
  const res = await fetch(`${API_URL}/api/chat/conversations`, { headers: headers(token) })
  const json = await handleResponse<{ conversations: ChatConversation[] }>(res)
  return json.conversations
}

export async function apiCreateConversation(
  token: string,
  dietaryRestrictions: string[],
  servings: number,
): Promise<ChatConversation> {
  const res = await fetch(`${API_URL}/api/chat/conversations`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ dietaryRestrictions, servings }),
  })
  const json = await handleResponse<{ conversation: ChatConversation }>(res)
  return json.conversation
}

export async function apiGetConversation(
  token: string,
  id: string,
): Promise<{ conversation: ChatConversation; messages: ChatMessageItem[] }> {
  const res = await fetch(`${API_URL}/api/chat/conversations/${id}`, { headers: headers(token) })
  const json = await handleResponse<{ conversation: ChatConversation & { messages: ChatMessageItem[] } }>(res)
  const { messages, ...conversation } = json.conversation
  return { conversation, messages }
}

export async function apiDeleteConversation(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/conversations/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await handleResponse<{ success: boolean }>(res)
}

export async function apiSuggestRecipe(
  token: string,
  conversationId: string,
  lang: string,
): Promise<{ recipes: RecipeCard[] }> {
  const res = await fetch(
    `${API_URL}/api/chat/conversations/${conversationId}/suggest-recipe?lang=${lang}`,
    { method: 'POST', headers: headers(token) },
  )
  return handleResponse<{ recipes: RecipeCard[]; notEnoughInfo: boolean }>(res)
}

export interface StreamChatMessageCallbacks {
  onToken: (token: string) => void
  onDone: (payload: { messageId: string; title?: string }) => void
  onError: (message: string) => void
}

// Deliberate exception to the generic handleResponse<T>() pattern used
// everywhere else in this file — streaming can't go through a single JSON
// parse, it reads the response body incrementally as SSE frames. Mirrors the
// hand-rolled SSE parsing pattern from the neurodivergent-app reference.
export async function streamChatMessage(
  token: string,
  conversationId: string,
  body: { content: string; language: string; nearbyStoresSummary?: string },
  callbacks: StreamChatMessageCallbacks,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    callbacks.onError(json.error ?? 'generic')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Frames are separated by a blank line ("\n\n"); tolerate a frame
      // being split across chunk boundaries by only consuming complete
      // frames and keeping the remainder in the buffer.
      let sepIndex: number
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        const line = rawFrame.split('\n').find((l) => l.startsWith('data: '))
        if (!line) continue

        try {
          const frame = JSON.parse(line.slice(6)) as
            | { type: 'token'; value: string }
            | { type: 'done'; messageId: string; title?: string }
            | { type: 'error'; message: string }

          if (frame.type === 'token') callbacks.onToken(frame.value)
          else if (frame.type === 'done') callbacks.onDone({ messageId: frame.messageId, title: frame.title })
          else if (frame.type === 'error') callbacks.onError(frame.message)
        } catch {
          // Malformed frame — skip it rather than breaking the whole stream.
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
