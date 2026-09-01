import { useEffect, useRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useTranslation } from 'react-i18next'
import ChatSuggestionCards from '../ChatSuggestionCards'
import { MessagesWrapper, Bubble } from './ChatMessageList.styles'
import type { ChatMessageItem, RecipeCard as RecipeCardType } from '../../../utils/types'

// A "suggest a recipe" result, positioned at the point in the conversation
// where it was requested — afterIndex is how many messages existed at that
// moment (0 = before any message). Rendered inline between the messages
// that came before and after it, rather than always pinned to the very
// bottom of the whole conversation regardless of when it happened; that was
// the bug (a later reply about the same suggestion ended up rendered above
// the recipes it was about). recipes: [] renders the "couldn't find a
// match" text instead of cards.
export interface SuggestionEvent {
  id: string
  afterIndex: number
  recipes: RecipeCardType[]
}

export interface ChatMessageListProps {
  messages: ChatMessageItem[]
  suggestionEvents: SuggestionEvent[]
  onSelectRecipe: (id: number) => void
  favoriteIds?: Set<number>
  onToggleFavorite?: (id: number) => void
  pendingFavoriteId?: number
}

// User text renders as plain text (white-space: pre-wrap in the Bubble
// style) — a user's own literal '*'/'_'/backtick shouldn't be reinterpreted
// as markdown formatting. Assistant text goes through ReactMarkdown.
// Deliberately no rehype-raw plugin (so raw HTML in the model's output is
// never rendered), plus rehype-sanitize as an explicit second layer.
export default function ChatMessageList({
  messages,
  suggestionEvents,
  onSelectRecipe,
  favoriteIds,
  onToggleFavorite,
  pendingFavoriteId,
}: ChatMessageListProps) {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // scrollIntoView isn't implemented in jsdom (test environment) — guard
    // rather than assume it exists.
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.content, suggestionEvents.length])

  const eventsAt = (index: number): SuggestionEvent[] =>
    suggestionEvents.filter((e) => e.afterIndex === index)

  // Suggestion events never arrive as bare cards — they're always preceded
  // by a short, warm assistant-style bubble (found some ideas, or came up
  // empty), so a suggestion reads as part of the conversation rather than a
  // cold widget dropped in with no lead-in.
  const renderSuggestion = (event: SuggestionEvent) =>
    event.recipes.length === 0 ? (
      <Bubble key={event.id} $role="assistant">
        {t('chat.noSuggestions')}
      </Bubble>
    ) : (
      <div key={event.id}>
        <Bubble $role="assistant">{t('chat.suggestionsIntro')}</Bubble>
        <ChatSuggestionCards
          recipes={event.recipes}
          onSelect={onSelectRecipe}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          pendingFavoriteId={pendingFavoriteId}
        />
      </div>
    )

  const matchedIds = new Set<string>()
  const nodes: ReactNode[] = []

  eventsAt(0).forEach((e) => {
    nodes.push(renderSuggestion(e))
    matchedIds.add(e.id)
  })

  messages.forEach((m, idx) => {
    nodes.push(
      <Bubble key={m.id} $role={m.role}>
        {m.role === 'assistant' ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {m.content}
          </ReactMarkdown>
        ) : (
          m.content
        )}
      </Bubble>,
    )
    eventsAt(idx + 1).forEach((e) => {
      nodes.push(renderSuggestion(e))
      matchedIds.add(e.id)
    })
  })

  // Safety net — an event whose afterIndex never matched (e.g. captured
  // right as a conversation was being switched) still renders, at the end,
  // rather than silently disappearing.
  suggestionEvents.filter((e) => !matchedIds.has(e.id)).forEach((e) => nodes.push(renderSuggestion(e)))

  return (
    <MessagesWrapper>
      {nodes}
      <div ref={bottomRef} />
    </MessagesWrapper>
  )
}
