import Chip from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import { Wrapper, ChipsRow } from './QuickReplies.styles'

export interface QuickRepliesProps {
  pantryItemNames: string[]
  onPickTime: (phrase: string) => void
  onPickIngredient: (name: string) => void
}

const TIME_OPTIONS = ['time10', 'time30', 'time60', 'timeMore'] as const

// Optional convenience row shown above the composer during an active
// conversation — always visible rather than trying to detect "is the AI
// currently asking about time vs. ingredients" from the reply text (fragile
// to get right, simple to skip). Tapping a chip inserts text into the
// composer (via ChatComposer's imperative handle) rather than sending
// immediately, so several taps can be combined before hitting send.
export default function QuickReplies({ pantryItemNames, onPickTime, onPickIngredient }: QuickRepliesProps) {
  const { t } = useTranslation()

  // Cap the row so it doesn't itself become a wall of chips — the pantry
  // can have far more items than fit comfortably in one scrollable row.
  const ingredientChips = pantryItemNames.slice(0, 8)

  return (
    <Wrapper>
      <ChipsRow role="group" aria-label={t('chat.quickReplies.timeGroupLabel')}>
        {TIME_OPTIONS.map((key) => (
          <Chip
            key={key}
            size="small"
            variant="outlined"
            label={t(`chat.quickReplies.${key}Label`)}
            clickable
            onClick={() => onPickTime(t(`chat.quickReplies.${key}Phrase`))}
          />
        ))}
      </ChipsRow>
      {ingredientChips.length > 0 && (
        <ChipsRow role="group" aria-label={t('chat.quickReplies.ingredientsGroupLabel')}>
          {ingredientChips.map((name) => (
            <Chip
              key={name}
              size="small"
              variant="outlined"
              color="primary"
              label={name}
              clickable
              onClick={() => onPickIngredient(name)}
            />
          ))}
        </ChipsRow>
      )}
    </Wrapper>
  )
}
