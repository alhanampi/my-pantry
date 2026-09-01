import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { MessagesWrapper, Bubble } from './ChatMessageList.styles'
import type { ChatMessageItem } from '../../../utils/types'

export interface ChatMessageListProps {
  messages: ChatMessageItem[]
}

// User text renders as plain text (white-space: pre-wrap in the Bubble
// style) — a user's own literal '*'/'_'/backtick shouldn't be reinterpreted
// as markdown formatting. Assistant text goes through ReactMarkdown.
// Deliberately no rehype-raw plugin (so raw HTML in the model's output is
// never rendered), plus rehype-sanitize as an explicit second layer.
export default function ChatMessageList({ messages }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // scrollIntoView isn't implemented in jsdom (test environment) — guard
    // rather than assume it exists.
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.content])

  return (
    <MessagesWrapper>
      {messages.map((m) => (
        <Bubble key={m.id} $role={m.role}>
          {m.role === 'assistant' ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {m.content}
            </ReactMarkdown>
          ) : (
            m.content
          )}
        </Bubble>
      ))}
      <div ref={bottomRef} />
    </MessagesWrapper>
  )
}
