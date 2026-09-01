import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { streamChatMessage } from '../api/chatApi'
import type { ChatMessageItem } from '../utils/types'

// Sending a message isn't a useMutation — streaming doesn't fit that shape
// (no single resolved value, tokens arrive incrementally). This hook owns
// local message state instead: optimistic user+placeholder-assistant
// bubbles, tokens streamed into the placeholder, reconciled with the server
// via a ['chat','conversation', id] invalidation once the stream completes.
export function useChatSession(conversationId: string | null, initialMessages: ChatMessageItem[]) {
  const { getToken } = useAuth()
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const [messages, setMessages] = useState<ChatMessageItem[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)

  const resetMessages = (next: ChatMessageItem[]): void => setMessages(next)

  const sendMessage = async (content: string, nearbyStoresSummary?: string): Promise<void> => {
    if (!conversationId || isStreaming) return
    setStreamError(null)

    const userMessage: ChatMessageItem = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    const placeholderId = `local-assistant-${Date.now()}`
    const placeholder: ChatMessageItem = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage, placeholder])
    setIsStreaming(true)

    const token = await getToken()
    if (!token) {
      setStreamError('generic')
      setIsStreaming(false)
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId))
      return
    }

    try {
      await streamChatMessage(
        token,
        conversationId,
        { content, language: i18n.language, nearbyStoresSummary },
        {
          onToken: (delta) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? { ...m, content: m.content + delta } : m)),
            )
          },
          onDone: ({ messageId }) => {
            setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, id: messageId } : m)))
            setIsStreaming(false)
            void qc.invalidateQueries({ queryKey: ['chat', 'conversation', conversationId] })
            void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
          },
          onError: (message) => {
            setStreamError(message)
            setIsStreaming(false)
            // Only the assistant placeholder is rolled back — the user's
            // message was already persisted server-side before Groq was
            // ever called, so it stays in the transcript.
            setMessages((prev) => prev.filter((m) => m.id !== placeholderId))
          },
        },
      )
    } catch {
      // streamChatMessage's own onError only covers a bad HTTP response —
      // this catches fetch() rejecting outright (offline/network failure).
      // Without it, isStreaming stayed true forever: the composer looked
      // (and was) permanently disabled after a dropped connection, with no
      // way to recover short of leaving and re-entering the conversation.
      setStreamError('generic')
      setIsStreaming(false)
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId))
    }
  }

  return { messages, resetMessages, sendMessage, isStreaming, streamError }
}
