import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import ChatSuggestionCards from '../ChatSuggestionCards'
import { usePantryChatSuggestions } from '../../../hooks/useChat'
import { Wrapper, Heading, LoadingRow, EmptyHint } from './PantrySuggestions.styles'

export interface PantrySuggestionsProps {
  onSelectRecipe: (id: string) => void
}

// Proactive recipe ideas shown before the user types anything, based on
// what's actually in the pantry (soonest-to-expire first — see
// loadPantryNames in backend/src/routes/chat.ts). Tapping a card jumps
// straight to that recipe's detail, the same "no conversation needed"
// shortcut as tapping an existing suggestion card mid-chat.
export default function PantrySuggestions({ onSelectRecipe }: PantrySuggestionsProps) {
  const { t } = useTranslation()
  const { data, isLoading } = usePantryChatSuggestions()

  if (isLoading) {
    return (
      <LoadingRow>
        <CircularProgress size={16} />
        <span>{t('chat.pantrySuggestions.loading')}</span>
      </LoadingRow>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Wrapper>
        <EmptyHint>{t('chat.pantrySuggestions.emptyHint')}</EmptyHint>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Heading>{t('chat.pantrySuggestions.heading')}</Heading>
      <ChatSuggestionCards recipes={data} onSelect={onSelectRecipe} />
    </Wrapper>
  )
}
